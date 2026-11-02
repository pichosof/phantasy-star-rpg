import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { entityEvents, type EntityRevealed } from '../src/core/events/entity-events';
import { askOracle } from '../src/core/use-cases/dice/oracle';
import { DiceExpressionError, parseDice, rollDice } from '../src/core/use-cases/dice/roll';
import { healthBand, toPlayerBoard } from '../src/core/use-cases/encounters/player-board';
import { readDiscordConfig } from '../src/infra/config/env';
import {
  imageUrl,
  toDiscordMarkdown,
  truncate,
  UnsupportedImageUrlError,
} from '../src/infra/discord/format';
import { combatReply } from '../src/infra/discord/handlers/combat';
import { parseRerollId, rollReply } from '../src/infra/discord/handlers/dice';
import { itemChoices, itemReply, resolveItemId } from '../src/infra/discord/handlers/item';
import { sessionReply } from '../src/infra/discord/handlers/journal';
import {
  clearEntityCache,
  entityChoices,
  lookupReply,
  resolveRef,
} from '../src/infra/discord/handlers/lookup';
import { revealReply } from '../src/infra/discord/handlers/reveal';

import { createTestApi, type TestApi } from './helpers';

let api: TestApi;
beforeAll(async () => {
  api = await createTestApi();
});
afterAll(async () => {
  await api.close();
});
// The DB is wiped before each test: never let autocomplete serve a previous test's rows.
beforeEach(() => clearEntityCache());

/** Deterministic dice: returns the given values in order. */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const json = (r: { json(): unknown }) => r.json() as Record<string, unknown>;

async function createCity(name: string, visible: boolean) {
  const res = await api.gm({
    method: 'POST',
    url: '/api/cities',
    payload: { name, description: `About [[${name}]] and its secrets.` },
  });
  expect(res.statusCode).toBe(201);
  const body = json(res);
  const id = Number(body.id ?? (body.props as { id: number }).id);
  const vis = await api.gm({
    method: 'PATCH',
    url: `/api/cities/${id}/visibility`,
    payload: { visible },
  });
  expect(vis.statusCode).toBe(204);
  return id;
}

describe('dice', () => {
  it('parses and totals expressions with modifiers and keep', () => {
    const r = rollDice('2d6 + 1d4 - 2', seq(3, 5, 4));
    expect(r.expression).toBe('2d6 + 1d4 - 2');
    expect(r.total).toBe(3 + 5 + 4 - 2);

    const keep = rollDice('4d6kh3', seq(6, 1, 4, 3));
    expect(keep.total).toBe(13);
    expect(keep.terms[0].dice.map((d) => d.kept)).toEqual([true, false, true, true]);

    expect(rollDice('2d20kl1', seq(17, 9)).total).toBe(9);
  });

  it('flags natural 20 / 1 only on a single kept d20', () => {
    expect(rollDice('1d20+5', seq(20)).natural).toBe('crit');
    expect(rollDice('d20', seq(1)).natural).toBe('fumble');
    expect(rollDice('2d20', seq(20, 3)).natural).toBeUndefined();
    expect(rollDice('2d20kh1', seq(20, 3)).natural).toBe('crit');
  });

  it('rejects invalid or abusive expressions', () => {
    for (const bad of [
      '',
      'abc',
      '1d1',
      '0d6',
      '101d6',
      '1d20+',
      '4d6kh5',
      '1d100000',
      '1+'.repeat(30),
    ])
      expect(() => parseDice(bad), bad).toThrow(DiceExpressionError);
  });

  it('answers with a breakdown and a reroll button (none for secret rolls)', () => {
    const reply = rollReply('1d20+5', { label: 'Stealth', who: 'Linus', random: seq(20) });
    const text = reply.embeds?.[0].description ?? '';
    expect(text).toContain('[**20**] + 5 = **25**');
    expect(text).toContain('Natural 20');
    const button = reply.components?.[0].components[0] as { custom_id: string };
    expect(parseRerollId(button.custom_id)).toEqual({ expression: '1d20 + 5', label: 'Stealth' });

    const secret = rollReply('1d6', { who: 'GM', secret: true, random: seq(4) });
    expect(secret.ephemeral).toBe(true);
    expect(secret.components).toEqual([]);

    expect(rollReply('1d1', { who: 'x' }).ephemeral).toBe(true);
  });

  it('oracle compares d100 with the odds', () => {
    expect(askOracle('likely', seq(10)).answer).toBe('Yes');
    expect(askOracle('likely', seq(80)).answer).toBe('No');
    expect(askOracle('even', seq(2)).degree).toBe('and');
    expect(askOracle('even', seq(44)).twist).toBe(true);
  });
});

describe('player combat board', () => {
  const pool = (current: number, max: number) => ({ current, max });
  const combatant = (over: Record<string, unknown>) => ({
    id: String(Math.random()),
    kind: 'monster',
    name: 'Sink-Beetle',
    initiative: 12,
    initBonus: 3,
    sp: pool(0, 10),
    hp: pool(10, 20),
    rp: pool(0, 0),
    eac: 15,
    kac: 17,
    conditions: [],
    notes: 'Weak to fire',
    defeated: false,
    ...over,
  });

  it('shows party pools but only a health band for foes', () => {
    const board = toPlayerBoard({
      round: 2,
      turn: 1,
      log: [],
      combatants: [
        combatant({ kind: 'pc', name: 'Linus', sp: pool(8, 12), hp: pool(14, 14), rp: pool(3, 4) }),
        combatant({ conditions: [{ id: 'c', name: 'Prone', rounds: null }] }),
      ],
    });
    expect(board.entries[0]).toMatchObject({
      pools: { sp: '8/12', hp: '14/14', rp: '3/4' },
      health: null,
    });
    expect(board.entries[1]).toMatchObject({
      pools: null,
      health: 'Bloodied',
      current: true,
      conditions: ['Prone'],
    });
    expect(JSON.stringify(board)).not.toMatch(/Weak to fire|eac|kac|initBonus/);
  });

  it('health bands', () => {
    const c = (sp: number, hp: number) => ({ sp: pool(sp, 10), hp: pool(hp, 10), defeated: false });
    expect(healthBand(c(10, 10))).toBe('Unhurt');
    expect(healthBand(c(5, 10))).toBe('Hurt');
    expect(healthBand(c(0, 8))).toBe('Bloodied');
    expect(healthBand(c(0, 3))).toBe('Critical');
    expect(healthBand(c(0, 0))).toBe('Down');
  });

  it('posts the active encounter and announces saves', async () => {
    expect((await combatReply()).ephemeral).toBe(true);

    const created = json(
      await api.gm({ method: 'POST', url: '/api/gm/encounters', payload: { name: 'Dune ambush' } }),
    );
    const id = Number(created.id);
    const saved: number[] = [];
    const off = entityEvents.encounterSaved.on(({ id: saveId }) => void saved.push(saveId));
    const put = await api.gm({
      method: 'PUT',
      url: `/api/gm/encounters/${id}`,
      payload: {
        version: 1,
        state: { round: 1, turn: 0, log: [], combatants: [combatant({ notes: 'secret' })] },
      },
    });
    expect(put.statusCode).toBe(200);
    await new Promise((r) => setTimeout(r, 10));
    off();
    expect(saved).toEqual([id]);

    const reply = await combatReply();
    expect(reply.encounterId).toBe(id);
    expect(reply.embeds?.[0].title).toBe('Dune ambush');
    expect(reply.embeds?.[0].description).toContain('Sink-Beetle');
    expect(JSON.stringify(reply)).not.toContain('secret');
  });
});

describe('lookup visibility', () => {
  it('players never see hidden entities, in suggestions or answers', async () => {
    const shown = await createCity('Piata', true);
    const hidden = await createCity('Sala Zero', false);

    const playerNames = (await entityChoices('', false)).map((c) => c.name).join('|');
    expect(playerNames).toContain('Piata');
    expect(playerNames).not.toContain('Sala Zero');

    expect(await resolveRef('Sala Zero', false)).toHaveProperty('error');
    const player = await lookupReply({ type: 'city', id: hidden }, { gm: false, private: false });
    expect(player.ephemeral).toBe(true);
    expect(JSON.stringify(player)).not.toContain('secrets');

    const ok = await lookupReply({ type: 'city', id: shown }, { gm: false, private: false });
    expect(ok.ephemeral).toBe(false);
    expect(ok.embeds?.[0].title).toBe('Piata');
    expect(ok.embeds?.[0].description).toContain('**Piata**');
  });

  it('the GM gets hidden entries only privately', async () => {
    const hidden = await createCity('Sala Zero', false);

    const gmChoices = await entityChoices('sala', true);
    expect(gmChoices[0]).toMatchObject({ value: `city:${hidden}` });
    expect(gmChoices[0].name).toContain('hidden');

    const inChannel = await lookupReply({ type: 'city', id: hidden }, { gm: true, private: false });
    expect(inChannel.ephemeral).toBe(true);
    expect(JSON.stringify(inChannel)).not.toContain('secrets');

    const priv = await lookupReply({ type: 'city', id: hidden }, { gm: true, private: true });
    expect(priv.ephemeral).toBe(true);
    expect(priv.embeds?.[0].description).toContain('secrets');
    expect(priv.embeds?.[0].footer?.text).toContain('Hidden');
  });

  it('reveal makes it visible and publishes the event', async () => {
    const hidden = await createCity('Sala Zero', false);
    const events: EntityRevealed[] = [];
    const off = entityEvents.revealed.on((e) => void events.push(e));

    const reply = await revealReply({ type: 'city', id: hidden });
    await new Promise((r) => setTimeout(r, 10));
    off();
    expect(reply.embeds?.[0].description).toContain('now visible');
    expect(events).toEqual([{ type: 'city', id: hidden }]);

    const player = await lookupReply({ type: 'city', id: hidden }, { gm: false, private: false });
    expect(player.embeds?.[0].title).toBe('Sala Zero');
    expect((await revealReply({ type: 'city', id: hidden })).embeds?.[0].description).toContain(
      'already visible',
    );
  });

  it('sessions: only published ones, latest by default', async () => {
    expect((await sessionReply(null)).ephemeral).toBe(true);
    for (const [title, visible] of [
      ['First', true],
      ['Secret prep', false],
    ] as const) {
      const s = json(
        await api.gm({
          method: 'POST',
          url: '/api/sessions',
          payload: { title, summary: `${title} text`, date: 'AW 2284' },
        }),
      );
      const id = Number(s.id ?? (s.props as { id: number }).id);
      await api.gm({
        method: 'PATCH',
        url: `/api/sessions/${id}/visibility`,
        payload: { visible },
      });
    }
    const latest = await sessionReply(null);
    expect(latest.embeds?.[0].title).toBe('First');
    expect(latest.embeds?.[0].author?.name).toContain('Session 1 of 1');
    expect((await sessionReply(2)).ephemeral).toBe(true);
  });
});

describe('item card', () => {
  it('players get the catalogue view; GM notes only in the private GM view', async () => {
    const res = await api.gm({
      method: 'POST',
      url: '/api/gm/items/import',
      payload: {
        items: [
          {
            code: 'W-1',
            name: 'Laser Pistol',
            kind: 'weapon',
            level: 1,
            damage: '1d4 F',
            localPrice: 350,
            refPrice: 260,
            access: 'free',
            gmNotes: 'Smuggled from Aerodyn',
            visibility: 'public',
            status: 'published',
          },
          {
            code: 'R-1',
            name: 'Relic Core',
            kind: 'tech',
            level: 9,
            gmNotes: 'x',
            visibility: 'gm',
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);

    const names = (await itemChoices('', false)).map((c) => c.name).join('|');
    expect(names).toContain('Laser Pistol');
    expect(names).not.toContain('Relic Core');

    const [pistol] = await itemChoices('laser', false);
    const player = JSON.stringify(
      await itemReply(Number(pistol.value), { gm: true, private: false }),
    );
    expect(player).toContain('350 cr');
    expect(player).not.toMatch(/Smuggled|260/);

    const gm = JSON.stringify(await itemReply(Number(pistol.value), { gm: true, private: true }));
    expect(gm).toContain('Smuggled from Aerodyn');
  });
});

describe('format', () => {
  it('converts site Markdown to Discord', () => {
    expect(toDiscordMarkdown('See [[npc:Rook|the soldier]] in [[Piata]]. ![x](/a.png)')).toBe(
      'See **the soldier** in **Piata**.',
    );
    expect(truncate('one two three four', 12)).toBe('one two…');
  });

  it('makes uploaded images absolute thumbnails', () => {
    expect(imageUrl('/files/cities/piata.png')).toBe(
      'https://api.test/files/cities/piata.png?w=640',
    );
    expect(imageUrl('https://res.cloudinary.com/x.png')).toBe('https://res.cloudinary.com/x.png');
    expect(() => imageUrl('relative.png')).toThrow(UnsupportedImageUrlError);
    expect(imageUrl(null)).toBeUndefined();
  });
});

describe('no guessing', () => {
  it('typed names must match exactly and uniquely', async () => {
    const piata = await createCity('Piata', true);
    expect(await resolveRef('PIATA', false)).toEqual({ ref: { type: 'city', id: piata } });
    expect(await resolveRef('Piat', false)).toHaveProperty('error');

    await api.gm({ method: 'POST', url: '/api/lores', payload: { title: 'Piata', visible: true } });
    const both = await resolveRef('Piata', false);
    expect('error' in both && both.error).toContain('City, Lore');
    // A picked suggestion is unambiguous.
    expect(await resolveRef(`city:${piata}`, false)).toEqual({ ref: { type: 'city', id: piata } });
  });

  it('items: exact name or code only', async () => {
    await api.gm({
      method: 'POST',
      url: '/api/gm/items/import',
      payload: {
        items: [
          {
            code: 'W-9',
            name: 'Laser Rifle',
            kind: 'weapon',
            visibility: 'public',
            status: 'published',
          },
        ],
      },
    });
    expect(await resolveItemId('laser rifle', false)).toHaveProperty('id');
    expect(await resolveItemId('w-9', false)).toHaveProperty('id');
    expect(await resolveItemId('laser', false)).toHaveProperty('error');
  });
});

describe('discord config', () => {
  const full = {
    DISCORD_TOKEN: 't',
    DISCORD_GUILD_ID: 'g',
    DISCORD_GM_USER_IDS: 'u1, u2',
    DISCORD_ANNOUNCE_CHANNEL_ID: '',
    SITE_URL: 'https://rpg.example/',
    PUBLIC_API_URL: 'https://api.example',
  };

  it('is off without a token and strict with one', () => {
    expect(readDiscordConfig({})).toBeNull();
    expect(readDiscordConfig(full)).toMatchObject({
      gmUserIds: ['u1', 'u2'],
      announceChannelId: '',
      siteUrl: 'https://rpg.example',
    });
    for (const key of ['DISCORD_GUILD_ID', 'DISCORD_GM_USER_IDS', 'SITE_URL', 'PUBLIC_API_URL'])
      expect(() => readDiscordConfig({ ...full, [key]: '' }), key).toThrow(key);
    const noAnnounce: Record<string, string | undefined> = { ...full };
    delete noAnnounce.DISCORD_ANNOUNCE_CHANNEL_ID;
    expect(() => readDiscordConfig(noAnnounce)).toThrow('DISCORD_ANNOUNCE_CHANNEL_ID');
    expect(() => readDiscordConfig({ ...full, SITE_URL: 'rpg.example' })).toThrow();
  });
});

describe('/api/health/discord', () => {
  it('reports a broken bot as 503 with the reason', async () => {
    const { setBotStatus } = await import('../src/infra/discord/status');
    try {
      expect(
        (await api.app.inject({ method: 'GET', url: '/api/health/discord' })).json(),
      ).toMatchObject({ state: 'off' });
      setBotStatus('error', new Error('An invalid token was provided.'));
      const res = await api.app.inject({ method: 'GET', url: '/api/health/discord' });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toMatchObject({ state: 'error', error: 'An invalid token was provided.' });
      expect(res.json()).toHaveProperty('version');
    } finally {
      setBotStatus('off');
    }
  });
});

describe('pictures', () => {
  it('a city with only a gallery shows its cover plus a mosaic, like the site', async () => {
    const { db, schema } = await import('../src/infra/db');
    const id = await createCity('Piata', true);
    await api.gm({
      method: 'PATCH',
      url: `/api/cities/${id}/discovered`,
      payload: { discovered: true },
    });
    const urls = [1, 2, 3, 4, 5, 6].map((n) => `/files/cities/images/${id}-${n}.png`);
    await db
      .insert(schema.cityImages)
      .values(urls.map((url, i) => ({ cityId: id, url, mime: 'image/png', size: 1, position: i })));

    const reply = await lookupReply({ type: 'city', id }, { gm: false, private: false });
    const embeds = reply.embeds ?? [];
    expect(embeds).toHaveLength(4);
    expect(embeds[0].image?.url).toBe(`https://api.test${urls[0]}?w=640`);
    expect(embeds.slice(1).map((e) => e.image?.url)).toEqual(
      urls.slice(1, 4).map((u) => `https://api.test${u}?w=640`),
    );
    // Same url on every embed: Discord merges them into one card.
    expect(new Set(embeds.map((e) => e.url)).size).toBe(1);
    expect(embeds[0].footer?.text).toContain('+2 more pictures');
  });

  it('undiscovered cities show no pictures to players', async () => {
    const { db, schema } = await import('../src/infra/db');
    const id = await createCity('Lost Town', true);
    await db
      .insert(schema.cityImages)
      .values({ cityId: id, url: '/files/x.png', mime: 'image/png', size: 1 });
    await api.gm({
      method: 'PATCH',
      url: `/api/cities/${id}/discovered`,
      payload: { discovered: false },
    });
    const reply = await lookupReply({ type: 'city', id }, { gm: false, private: false });
    expect(JSON.stringify(reply)).not.toContain('/files/x.png');
  });
});

describe('branding', () => {
  it('every card header carries the site icon; mosaic images stay bare', async () => {
    const { branded } = await import('../src/infra/discord/format');
    expect(
      branded([
        { author: { name: 'City' }, title: 'Piata' },
        { url: 'x', image: { url: 'y' } },
      ]),
    ).toEqual([
      { author: { name: 'City', icon_url: 'https://site.test/logo192.png' }, title: 'Piata' },
      { url: 'x', image: { url: 'y' } },
    ]);
  });
});
