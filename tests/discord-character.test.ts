import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  armorClass,
  initiativeBonus,
  parseStarfinderSheet,
  saveBonus,
  SheetDataError,
  skillBonus,
  weaponRoll,
} from '../src/core/use-cases/character-sheets/starfinder';
import {
  attackReply,
  checkReply,
  linkReply,
  meReply,
  NOT_LINKED,
  progressReply,
  questsReply,
  saveReply,
  skillChoices,
} from '../src/infra/discord/handlers/character';

import { createTestApi, type TestApi } from './helpers';

let api: TestApi;
beforeAll(async () => {
  api = await createTestApi();
});
afterAll(async () => {
  await api.close();
});

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};
/** The sheet without some fields. */
const without = (data: Record<string, unknown>, ...keys: string[]) =>
  Object.fromEntries(Object.entries(data).filter(([k]) => !keys.includes(k)));
const idOf = (body: unknown) => {
  const b = body as { id?: number; props?: { id: number } };
  return Number(b.id ?? b.props?.id);
};

/** Shape exported by the site's Starfinder form / Hephaistos import (Linus Mendel, level 1). */
const LINUS = {
  classLevel: 'Envoy 1',
  race: 'Human',
  str: 10,
  dex: 14,
  con: 10,
  int: 13,
  wis: 10,
  cha: 16,
  fortBase: 0,
  refBase: 2,
  willBase: 2,
  bab: 0,
  armorBonus: 1,
  armorKacBonus: 2,
  staminaCurrent: 6,
  staminaTotal: 6,
  hpCurrent: 10,
  hpTotal: 10,
  resolveCurrent: 4,
  resolveTotal: 4,
  credits: 120,
  skills: {
    stealth: { ranks: 1, classBonus: true, miscMod: 0 },
    diplomacy: { ranks: 1, classBonus: true, miscMod: 1 },
    profession1: { ranks: 1, classBonus: false, ability: 'int' },
  },
  weapons: [
    { name: 'Cestus Pistol, Tactical', attackBonus: '+2', damage: '1d4 P', range: '-' },
    { name: 'Knife, Survival', attackBonus: '+2', damage: '1d4 +1 S', critical: 'Bleed 2' },
    { name: 'Concussion Grenade, Mk 1', attackBonus: '+0', damage: '-' },
  ],
};

describe('starfinder rules (same numbers as the site)', () => {
  const sheet = parseStarfinderSheet(LINUS);

  it('skills: ranks + class (only with ranks) + ability + misc; Profession may change ability', () => {
    expect(skillBonus(sheet, 'stealth').total).toBe(1 + 3 + 2);
    expect(skillBonus(sheet, 'diplomacy').total).toBe(1 + 3 + 3 + 1);
    expect(skillBonus(sheet, 'profession1').total).toBe(1 + 0 + 1);
    expect(skillBonus(sheet, 'acrobatics')).toMatchObject({ total: 2, parts: '+2 DEX' });
    expect(() => skillBonus(sheet, 'computers')).toThrow('trained-only');
  });

  it('saves, initiative and armor class', () => {
    expect(saveBonus(sheet, 'fort').total).toBe(0);
    expect(saveBonus(sheet, 'ref').total).toBe(4);
    expect(saveBonus(sheet, 'will').total).toBe(2);
    expect(initiativeBonus(sheet).total).toBe(2);
    expect(armorClass(sheet)).toEqual({ eac: 13, kac: 14 });
    expect(armorClass({ ...sheet, armorMaxDex: 1 })).toEqual({ eac: 12, kac: 13 });
  });

  it('a value the roll needs must be on the sheet (no assumed 10 / 0)', () => {
    const partial = parseStarfinderSheet(without(LINUS, 'dex', 'refBase'));
    expect(() => skillBonus(partial, 'stealth')).toThrow('no DEX score');
    expect(() => saveBonus(partial, 'ref')).toThrow('no Reflex base save');
    expect(() => parseStarfinderSheet({ dex: 'fourteen' })).toThrow(SheetDataError);
  });

  it('reads weapons as the sheet writes them', () => {
    expect(weaponRoll(sheet, 'Knife, Survival')).toEqual({
      name: 'Knife, Survival',
      attack: 2,
      damage: '1d4+1',
      damageType: 'S',
      critical: 'Bleed 2',
    });
    expect(weaponRoll(sheet, 'Concussion Grenade, Mk 1').damage).toBeNull();
    expect(
      weaponRoll(
        parseStarfinderSheet({ weapons: [{ name: 'Gun', attackBonus: '+1', damage: '1d6 P' }] }),
        'Gun',
      ).damage,
    ).toBe('1d6');
    expect(() =>
      weaponRoll(parseStarfinderSheet({ weapons: [{ name: 'X', attackBonus: 'n/a' }] }), 'X'),
    ).toThrow('not a number');
    expect(() => weaponRoll(sheet, 'Laser Sword')).toThrow('no weapon');
  });
});

describe('linked character', () => {
  async function setup(data: Record<string, unknown> = LINUS) {
    const player = idOf(
      (
        await api.gm({ method: 'POST', url: '/api/players', payload: { name: 'Linus Mendel' } })
      ).json(),
    );
    const sheet = idOf(
      (
        await api.gm({
          method: 'POST',
          url: '/api/gm/sheets',
          payload: { type: 'starfinder', name: 'Linus Mendel', data },
        })
      ).json(),
    );
    return { player, sheet };
  }

  it('rolls need a link, and the GM links only real players and Starfinder sheets', async () => {
    expect((await checkReply('100000000000000001', 'stealth', false)).embeds?.[0].description).toBe(
      NOT_LINKED,
    );
    const { player, sheet } = await setup();
    const gurps = idOf(
      (
        await api.gm({
          method: 'POST',
          url: '/api/gm/sheets',
          payload: { type: 'gurps', name: 'Tobias' },
        })
      ).json(),
    );
    expect(JSON.stringify(await linkReply('100000000000000001', '999', null))).toContain(
      'does not exist',
    );
    expect(
      JSON.stringify(await linkReply('100000000000000001', String(player), String(gurps))),
    ).toContain('rolls need Starfinder');
    expect(JSON.stringify(await linkReply('100000000000000001', 'Linus', null))).toContain(
      'Pick the player',
    );
    const ok = await linkReply('100000000000000001', String(player), String(sheet));
    expect(ok.embeds?.[0].description).toContain('now plays **Linus Mendel**');
  });

  it('checks, saves and attacks use the sheet', async () => {
    const { player, sheet } = await setup();
    await linkReply('100000000000000002', String(player), String(sheet));
    const user = '100000000000000002';

    const check = await checkReply(user, 'stealth', false, seq(12));
    expect(check.embeds?.[0].author?.name).toBe('Linus Mendel rolls · Stealth');
    expect(check.embeds?.[0].description).toContain('[12] + 6 = **18**');
    expect(check.embeds?.[0].footer?.text).toBe('Stealth +6 = +2 DEX +1 ranks +3 class');

    expect((await saveReply(user, 'ref', true, seq(5))).ephemeral).toBe(true);
    expect((await checkReply(user, 'computers', false)).embeds?.[0].description).toContain(
      'trained-only',
    );

    const crit = await attackReply(user, 'Knife, Survival', seq(20, 3));
    const text = crit.embeds?.[0].description ?? '';
    expect(text).toContain('[**20**] + 2 = **22**');
    expect(text).toContain('[3] + 1 = **4** S');
    expect(text).toContain('Critical if it hits: **8** S + Bleed 2');

    const grenade = await attackReply(user, 'Concussion Grenade, Mk 1', seq(9));
    expect(grenade.embeds?.[0].description).toContain('no damage roll');

    const skills = await skillChoices(user, 'st');
    expect(skills).toContainEqual({ name: 'Stealth (+6)', value: 'stealth' });

    const me = await meReply(user);
    expect(me.ephemeral).toBe(true);
    expect(JSON.stringify(me)).toContain('13 · 14');
  });

  it('a sheet missing what a roll needs says what to fix', async () => {
    const { player, sheet } = await setup(without(LINUS, 'dex'));
    await linkReply('100000000000000003', String(player), String(sheet));
    const reply = await checkReply('100000000000000003', 'stealth', false);
    expect(reply.ephemeral).toBe(true);
    expect(reply.embeds?.[0].description).toContain('no DEX score');
    expect(reply.embeds?.[0].description).toContain('GM → Sheets');
  });

  it('quests: only visible ones, with the player status', async () => {
    const { player } = await setup();
    await linkReply('100000000000000004', String(player), null);
    for (const [title, visible] of [
      ['Clean the cellar', true],
      ['Secret: the Sala Zero', false],
    ] as const) {
      const q = idOf(
        (await api.gm({ method: 'POST', url: '/api/quests', payload: { title, visible } })).json(),
      );
      const res = await api.gm({ method: 'POST', url: `/api/players/${player}/quests/${q}` });
      expect(res.statusCode).toBeLessThan(300);
    }
    // Same rule as the site: a hidden character's quests and progress stay hidden.
    expect(JSON.stringify(await questsReply('100000000000000004'))).toContain(
      'not visible to players',
    );
    expect(JSON.stringify(await progressReply('100000000000000004'))).toContain(
      'not visible to players',
    );
    await api.gm({
      method: 'PATCH',
      url: `/api/players/${player}/visibility`,
      payload: { visible: true },
    });
    const text = JSON.stringify(await questsReply('100000000000000004'));
    expect(text).toContain('Clean the cellar');
    expect(text).not.toContain('Sala Zero');
    expect((await progressReply('100000000000000004')).embeds?.[0].description).toBe(
      '*No rewards yet.*',
    );
  });
});
