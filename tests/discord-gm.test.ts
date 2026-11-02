import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  addCondition,
  applyDamage,
  heal,
  nextTurn,
} from '../src/core/use-cases/encounters/combat-engine';
import type { EncounterState } from '../src/core/use-cases/encounters/encounter-state';
import { container } from '../src/di/container';
import { linkReply } from '../src/infra/discord/handlers/character';
import {
  combatantChoices,
  conditionChoices,
  encounterActionReply,
  handoutEmbeds,
  npcVoice,
  playerOfCombatant,
} from '../src/infra/discord/handlers/gm';
import { clearEntityCache } from '../src/infra/discord/handlers/lookup';

import { createTestApi, type TestApi } from './helpers';

let api: TestApi;
beforeAll(async () => {
  api = await createTestApi();
});
afterAll(async () => {
  await api.close();
});
beforeEach(() => clearEntityCache());

const idOf = (body: unknown) => {
  const b = body as { id?: number; props?: { id: number } };
  return Number(b.id ?? b.props?.id);
};
const pool = (current: number, max: number) => ({ current, max });
const fighter = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  kind: 'monster' as const,
  name: id,
  refId: null,
  initiative: 10,
  initBonus: 0,
  sp: pool(5, 5),
  hp: pool(10, 10),
  rp: pool(0, 0),
  conditions: [] as { id: string; name: string; rounds: number | null }[],
  notes: null,
  defeated: false,
  ...over,
});
const state = (over: Partial<EncounterState> = {}): EncounterState => ({
  round: 1,
  turn: 0,
  log: [],
  combatants: [fighter('A', { initiative: 20 }), fighter('B', { initiative: 15 }), fighter('C')],
  ...over,
});

describe('combat engine (same rules as the site tracker)', () => {
  it('damage drains Stamina first, then HP; hp_only skips Stamina', () => {
    const s = applyDamage(state(), 'A', 8);
    expect(s.combatants[0]).toMatchObject({ sp: pool(0, 5), hp: pool(7, 10) });
    expect(s.log[0].text).toBe('A takes 8 damage (5 SP + 3 HP).');
    expect(applyDamage(state(), 'A', 4, true).combatants[0].hp).toEqual(pool(6, 10));
    const down = applyDamage(state(), 'A', 30);
    expect(down.combatants[0].hp.current).toBe(0);
    expect(down.log[0].text).toBe('A drops to 0 HP.');
  });

  it('healing caps at the maximum', () => {
    const hurt = applyDamage(state(), 'A', 12);
    expect(heal(hurt, 'A', 'hp', 99).combatants[0].hp).toEqual(pool(10, 10));
  });

  it('next turn ticks conditions, skips the defeated and wraps rounds', () => {
    let s = addCondition(state(), 'A', 'Shaken', 1);
    s = {
      ...s,
      combatants: s.combatants.map((c) => (c.id === 'B' ? { ...c, defeated: true } : c)),
    };
    s = nextTurn(s);
    expect(s.turn).toBe(2);
    expect(s.combatants[0].conditions).toEqual([]);
    expect(s.log.map((l) => l.text)).toContain('A is no longer Shaken.');
    s = nextTurn(s);
    expect(s).toMatchObject({ round: 2, turn: 0 });
  });

  it('next on a fresh combat starts it (initiative order, round 1)', () => {
    const s = nextTurn(state({ round: 0 }));
    expect(s.round).toBe(1);
    expect(s.combatants.map((c) => c.id)).toEqual(['A', 'B', 'C']);
  });
});

describe('/encounter from Discord', () => {
  async function startEncounter(over: Partial<EncounterState> = {}) {
    const created = await api.gm({
      method: 'POST',
      url: '/api/gm/encounters',
      payload: { name: 'Dune ambush', state: state(over) },
    });
    expect(created.statusCode).toBe(201);
    return idOf(created.json());
  }

  it('needs a running combat', async () => {
    expect((await encounterActionReply({ type: 'next' })).embeds?.[0].description).toContain(
      'No combat is running',
    );
  });

  it('applies the action, saves a new version and lists what happened', async () => {
    const id = await startEncounter();
    const reply = await encounterActionReply({
      type: 'damage',
      target: 'B',
      amount: 7,
      hpOnly: false,
    });
    expect(reply.embeds?.[0].description).toBe('• B takes 7 damage (5 SP + 2 HP).');
    const saved = await container.resolve('getEncounter').execute(id);
    expect(saved.props.version).toBe(2);
    expect((await combatantChoices('b'))[0]).toMatchObject({
      value: 'B',
      name: 'B · SP 0/5 · HP 8/10',
    });

    expect(
      (await encounterActionReply({ type: 'damage', target: 'Z', amount: 1, hpOnly: false }))
        .embeds?.[0].description,
    ).toContain('not in this combat');
  });

  it('when the site saved first, the action lands on top of the newer state', async () => {
    const id = await startEncounter();
    const apply = container.resolve('applyEncounterAction');
    const save = container.resolve('saveEncounter');
    const realSave = save.execute.bind(save);
    let raced = false;
    // The site saves (damage on C) right before the bot's first save attempt.
    save.execute = async (encId, input) => {
      if (!raced) {
        raced = true;
        const current = await container.resolve('getEncounter').execute(encId);
        await realSave(encId, {
          version: current.props.version,
          state: applyDamage(current.props.state as EncounterState, 'C', 3),
        });
      }
      return realSave(encId, input);
    };
    try {
      await apply.execute(id, { type: 'damage', target: 'A', amount: 2, hpOnly: false });
    } finally {
      save.execute = realSave;
    }
    const final = (await container.resolve('getEncounter').execute(id)).props
      .state as EncounterState;
    expect(final.combatants.find((c) => c.id === 'C')?.sp.current).toBe(2);
    expect(final.combatants.find((c) => c.id === 'A')?.sp.current).toBe(3);
  });

  it('conditions: Starfinder list plus a custom one; clear offers what the target has', async () => {
    await startEncounter({
      combatants: [fighter('A', { conditions: [{ id: 'k1', name: 'Prone', rounds: null }] })],
    });
    expect(await conditionChoices('sha', null, false)).toEqual([
      { name: 'Custom: sha', value: 'sha' },
      { name: 'Shaken', value: 'Shaken' },
    ]);
    expect(await conditionChoices('', 'A', true)).toEqual([{ name: 'Prone', value: 'k1' }]);
  });

  it('finds the Discord user who plays a PC combatant', async () => {
    const player = idOf(
      (await api.gm({ method: 'POST', url: '/api/players', payload: { name: 'Kiran' } })).json(),
    );
    const sheet = idOf(
      (
        await api.gm({
          method: 'POST',
          url: '/api/gm/sheets',
          payload: { type: 'starfinder', name: 'Kiran', data: {} },
        })
      ).json(),
    );
    await linkReply('100000000000000009', String(player), String(sheet));
    expect(await playerOfCombatant(fighter('K', { kind: 'pc', refId: sheet }))).toBe(
      '100000000000000009',
    );
    expect(await playerOfCombatant(fighter('M'))).toBeNull();
  });
});

describe('/say and /handout', () => {
  it('NPC voice: name and portrait from the site; forbidden names are refused', async () => {
    const npc = idOf(
      (await api.gm({ method: 'POST', url: '/api/npcs', payload: { name: 'Mara' } })).json(),
    );
    expect(await npcVoice(String(npc))).toEqual({
      username: 'Mara',
      avatarURL: undefined,
      hasPortrait: false,
    });
    expect(await npcVoice('Mara')).toEqual({ error: 'Pick the NPC from the suggestions.' });
    const bad = idOf(
      (await api.gm({ method: 'POST', url: '/api/npcs', payload: { name: 'Discord Dan' } })).json(),
    );
    expect(await npcVoice(String(bad))).toHaveProperty('error');
  });

  it('handouts carry hidden content but never the GM-only "hidden" marker', async () => {
    const lore = idOf(
      (
        await api.gm({
          method: 'POST',
          url: '/api/lores',
          payload: { title: 'Sala Zero', content: 'Below the university.', visible: false },
        })
      ).json(),
    );
    const embeds = await handoutEmbeds({ type: 'lore', id: lore }, 'Found in the cellar.');
    const text = JSON.stringify(embeds);
    expect(text).toContain('Below the university.');
    expect(text).toContain('Found in the cellar.');
    expect(text).not.toContain('Hidden from players');
    expect(await handoutEmbeds({ type: 'lore', id: 99999 }, null)).toEqual({
      error: 'That entry does not exist.',
    });
  });
});
