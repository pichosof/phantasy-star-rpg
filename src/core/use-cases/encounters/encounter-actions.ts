import type { Encounter } from '../../entities/encounter.js';

import {
  addCondition,
  applyDamage,
  heal,
  nextTurn,
  removeCondition,
  setDefeated,
} from './combat-engine.js';
import { type EncounterState, encounterStateSchema } from './encounter-state.js';
import type { SaveEncounter } from './encounter-use-cases.js';
import type { EncounterRepository } from './encounter.repository.js';
import { EncounterConflictError, EncounterNotFoundError } from './errors.js';

/** What the GM can do to a running combat from outside the site tracker (Discord). */
export type EncounterAction =
  | { type: 'next' }
  | { type: 'damage'; target: string; amount: number; hpOnly: boolean }
  | { type: 'heal'; target: string; pool: 'sp' | 'hp' | 'rp'; amount: number }
  | { type: 'condition'; target: string; name: string; rounds: number | null }
  | { type: 'uncondition'; target: string; conditionId: string }
  | { type: 'defeated'; target: string; defeated: boolean };

export class EncounterActionError extends Error {
  readonly statusCode = 400;
}

function apply(state: EncounterState, action: EncounterAction): EncounterState {
  if (action.type === 'next') {
    if (!state.combatants.length) throw new EncounterActionError('The combat has no combatants.');
    return nextTurn(state);
  }
  const target = state.combatants.find((c) => c.id === action.target);
  if (!target) throw new EncounterActionError('That combatant is not in this combat anymore.');
  switch (action.type) {
    case 'damage':
      return applyDamage(state, target.id, action.amount, action.hpOnly);
    case 'heal':
      return heal(state, target.id, action.pool, action.amount);
    case 'condition':
      return addCondition(state, target.id, action.name, action.rounds);
    case 'uncondition':
      if (!target.conditions.some((k) => k.id === action.conditionId))
        throw new EncounterActionError(`${target.name} does not have that condition.`);
      return removeCondition(state, target.id, action.conditionId);
    case 'defeated':
      return setDefeated(state, target.id, action.defeated);
  }
}

/**
 * Applies one action with the same rules as the site tracker and saves it with the same
 * optimistic version check. If the site saved first, the action is applied again on top of
 * that newer state (never on a stale copy), so neither side's changes are lost.
 */
export class ApplyEncounterAction {
  constructor(
    private repo: EncounterRepository,
    private save: SaveEncounter,
  ) {}

  async execute(
    encounterId: number,
    action: EncounterAction,
  ): Promise<{ encounter: Encounter; log: string[] }> {
    for (let attempt = 1; ; attempt += 1) {
      const current = await this.repo.findById(encounterId);
      if (!current) throw new EncounterNotFoundError(encounterId);
      if (current.props.status === 'ended')
        throw new EncounterActionError('This combat has ended.');
      const state = encounterStateSchema.parse(current.props.state);
      const next = apply(state, action);
      if (next === state) throw new EncounterActionError('Nothing to change.');
      const before = new Set(state.log.map((l) => l.id));
      const log = next.log
        .filter((l) => !before.has(l.id))
        .map((l) => l.text)
        .reverse();
      try {
        const encounter = await this.save.execute(encounterId, {
          version: current.props.version,
          state: next,
        });
        return { encounter, log };
      } catch (e) {
        if (!(e instanceof EncounterConflictError) || attempt >= 3) throw e;
      }
    }
  }
}
