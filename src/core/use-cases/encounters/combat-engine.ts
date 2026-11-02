/**
 * Combat tracker rules (pure functions): turn order, Starfinder damage (Stamina first, then
 * Hit Points), conditions with round counters and the log. Every action returns a new state.
 *
 * Mirrors the front-end `src/pages/gm/combat/combat-engine.ts` so that an action taken from
 * Discord has exactly the effect of the same click on the site: change both together.
 */
import { randomInt, randomUUID } from 'node:crypto';

import type { Combatant, EncounterState } from './encounter-state.js';

type Condition = Combatant['conditions'][number];

/** Starfinder 1e conditions, offered as quick picks (custom names are allowed too). */
export const STARFINDER_CONDITIONS = [
  'Asleep',
  'Bleeding',
  'Blinded',
  'Broken',
  'Burning',
  'Confused',
  'Cowering',
  'Dazed',
  'Dazzled',
  'Deafened',
  'Dying',
  'Encumbered',
  'Entangled',
  'Exhausted',
  'Fascinated',
  'Fatigued',
  'Flat-footed',
  'Frightened',
  'Grappled',
  'Helpless',
  'Nauseated',
  'Off-target',
  'Overburdened',
  'Panicked',
  'Paralyzed',
  'Pinned',
  'Prone',
  'Shaken',
  'Sickened',
  'Stable',
  'Staggered',
  'Stunned',
  'Unconscious',
] as const;

const MAX_LOG = 400;

const uid = () => randomUUID();
const rollD20 = () => randomInt(1, 21);

const log = (s: EncounterState, text: string): EncounterState => ({
  ...s,
  log: [{ id: uid(), round: s.round, text, at: new Date().toISOString() }, ...s.log].slice(
    0,
    MAX_LOG,
  ),
});

const mapOne = (
  s: EncounterState,
  id: string,
  fn: (c: Combatant) => Combatant,
): EncounterState => ({
  ...s,
  combatants: s.combatants.map((c) => (c.id === id ? fn(c) : c)),
});

const byId = (s: EncounterState, id: string) => s.combatants.find((c) => c.id === id);

/** Whose turn it is (undefined before the combat starts). */
export const currentCombatant = (s: EncounterState): Combatant | undefined =>
  s.round > 0 ? s.combatants[s.turn] : undefined;

/** Highest initiative first; ties: higher bonus, then players before others, then name. */
const compare = (a: Combatant, b: Combatant) =>
  (b.initiative ?? -999) - (a.initiative ?? -999) ||
  b.initBonus - a.initBonus ||
  Number(b.kind === 'pc') - Number(a.kind === 'pc') ||
  a.name.localeCompare(b.name);

/** Sorts by initiative, keeping the pointer on whoever is acting. */
export function sortByInitiative(s: EncounterState): EncounterState {
  const acting = currentCombatant(s)?.id;
  const combatants = [...s.combatants].sort(compare);
  const turn = acting
    ? Math.max(
        0,
        combatants.findIndex((c) => c.id === acting),
      )
    : 0;
  return { ...s, combatants, turn };
}

/** Rolls d20 + bonus for the given combatants (default: everyone without initiative). */
export function rollInitiative(s: EncounterState, ids?: string[]): EncounterState {
  const targets = new Set(
    ids ?? s.combatants.filter((c) => c.initiative === null).map((c) => c.id),
  );
  if (!targets.size) return s;
  const rolls: string[] = [];
  const combatants = s.combatants.map((c) => {
    if (!targets.has(c.id)) return c;
    const d20 = rollD20();
    const initiative = d20 + c.initBonus;
    rolls.push(`${c.name} ${initiative} (d20 ${d20}${c.initBonus >= 0 ? '+' : ''}${c.initBonus})`);
    return { ...c, initiative };
  });
  return sortByInitiative(log({ ...s, combatants }, `Initiative: ${rolls.join(', ')}.`));
}

export function startCombat(s: EncounterState): EncounterState {
  const sorted = sortByInitiative(rollInitiative(s));
  const first = Math.max(
    0,
    sorted.combatants.findIndex((c) => !c.defeated),
  );
  return log({ ...sorted, round: 1, turn: first }, 'Combat started — round 1.');
}

/** Counts down the acting combatant's timed conditions at the end of their turn. */
function tickConditions(s: EncounterState, id: string): EncounterState {
  const c = byId(s, id);
  if (!c) return s;
  const expired: string[] = [];
  const conditions: Condition[] = [];
  for (const k of c.conditions) {
    if (k.rounds === null) conditions.push(k);
    else if (k.rounds > 1) conditions.push({ ...k, rounds: k.rounds - 1 });
    else expired.push(k.name);
  }
  const next = mapOne(s, id, (x) => ({ ...x, conditions }));
  return expired.length ? log(next, `${c.name} is no longer ${expired.join(', ')}.`) : next;
}

export function nextTurn(s: EncounterState): EncounterState {
  if (s.round === 0 || !s.combatants.length) return startCombat(s);
  const acting = currentCombatant(s);
  let next = acting ? tickConditions(s, acting.id) : s;
  const n = next.combatants.length;
  let turn = next.turn;
  let round = next.round;
  for (let step = 0; step < n; step += 1) {
    turn += 1;
    if (turn >= n) {
      turn = 0;
      round += 1;
    }
    if (!next.combatants[turn].defeated) break;
  }
  next = { ...next, turn, round };
  if (round !== s.round) next = log(next, `Round ${round}.`);
  return next;
}

/** Starfinder: damage drains Stamina first, then Hit Points. */
export function applyDamage(
  s: EncounterState,
  id: string,
  amount: number,
  hpOnly = false,
): EncounterState {
  const c = byId(s, id);
  if (!c || amount <= 0) return s;
  const toSp = hpOnly ? 0 : Math.min(amount, Math.max(0, c.sp.current));
  const toHp = amount - toSp;
  const hp = Math.max(0, c.hp.current - toHp);
  const sp = c.sp.current - toSp;
  const parts = [toSp ? `${toSp} SP` : '', toHp ? `${toHp} HP` : ''].filter(Boolean).join(' + ');
  let next = mapOne(s, id, (x) => ({
    ...x,
    sp: { ...x.sp, current: sp },
    hp: { ...x.hp, current: hp },
  }));
  next = log(next, `${c.name} takes ${amount} damage (${parts || '0'}).`);
  if (hp === 0 && c.hp.current > 0 && c.hp.max > 0) {
    next = log(next, c.kind === 'pc' ? `${c.name} is down (0 HP).` : `${c.name} drops to 0 HP.`);
  }
  return next;
}

export function heal(
  s: EncounterState,
  id: string,
  pool: 'sp' | 'hp' | 'rp',
  amount: number,
): EncounterState {
  const c = byId(s, id);
  if (!c || amount <= 0) return s;
  const p = c[pool];
  const current = p.max > 0 ? Math.min(p.max, p.current + amount) : p.current + amount;
  const label = pool.toUpperCase();
  return log(
    mapOne(s, id, (x) => ({ ...x, [pool]: { ...p, current } })),
    `${c.name} recovers ${current - p.current} ${label}.`,
  );
}

export function addCondition(
  s: EncounterState,
  id: string,
  name: string,
  rounds: number | null,
): EncounterState {
  const c = byId(s, id);
  const clean = name.trim();
  if (!c || !clean) return s;
  const existing = c.conditions.find((k) => k.name.toLowerCase() === clean.toLowerCase());
  const conditions = existing
    ? c.conditions.map((k) => (k === existing ? { ...k, rounds } : k))
    : [...c.conditions, { id: uid(), name: clean, rounds }];
  const span = rounds === null ? '' : ` for ${rounds} round${rounds === 1 ? '' : 's'}`;
  return log(
    mapOne(s, id, (x) => ({ ...x, conditions })),
    `${c.name} is ${clean}${span}.`,
  );
}

export function removeCondition(
  s: EncounterState,
  id: string,
  conditionId: string,
): EncounterState {
  const c = byId(s, id);
  const k = c?.conditions.find((x) => x.id === conditionId);
  if (!c || !k) return s;
  return log(
    mapOne(s, id, (x) => ({ ...x, conditions: x.conditions.filter((y) => y.id !== conditionId) })),
    `${c.name} is no longer ${k.name}.`,
  );
}

export function setDefeated(s: EncounterState, id: string, defeated: boolean): EncounterState {
  const c = byId(s, id);
  if (!c) return s;
  return log(
    mapOne(s, id, (x) => ({ ...x, defeated })),
    defeated ? `${c.name} is out of the fight.` : `${c.name} is back in the fight.`,
  );
}
