import type { Combatant, EncounterState } from './encounter-state.js';
import { encounterStateSchema } from './encounter-state.js';

/** How hurt a foe looks, without giving away its numbers. */
export type HealthBand = 'Unhurt' | 'Hurt' | 'Bloodied' | 'Critical' | 'Down';

export interface BoardEntry {
  name: string;
  kind: Combatant['kind'];
  initiative: number | null;
  current: boolean;
  defeated: boolean;
  /** Player characters only: the party knows its own pools. */
  pools: { sp: string; hp: string; rp: string } | null;
  /** Foes only. */
  health: HealthBand | null;
  conditions: string[];
}

export interface PlayerBoard {
  round: number;
  entries: BoardEntry[];
}

export function healthBand(c: Pick<Combatant, 'sp' | 'hp' | 'defeated'>): HealthBand {
  const max = c.sp.max + c.hp.max;
  const now = Math.max(0, c.sp.current) + Math.max(0, c.hp.current);
  if (c.defeated || c.hp.current <= 0) return 'Down';
  if (max <= 0 || now >= max) return 'Unhurt';
  const ratio = now / max;
  if (ratio > 0.5) return 'Hurt';
  if (ratio > 0.25) return 'Bloodied';
  return 'Critical';
}

/**
 * The initiative board as players may see it: turn order, whose turn it is and conditions;
 * foes show only a health band (no SP/HP, AC, bonuses or GM notes).
 */
export function toPlayerBoard(raw: unknown): PlayerBoard {
  const state: EncounterState = encounterStateSchema.parse(raw);
  return {
    round: state.round,
    entries: state.combatants.map((c, i) => {
      const pc = c.kind === 'pc';
      return {
        name: c.name,
        kind: c.kind,
        initiative: c.initiative,
        current: i === state.turn && state.round > 0,
        defeated: c.defeated,
        pools: pc
          ? {
              sp: `${c.sp.current}/${c.sp.max}`,
              hp: `${c.hp.current}/${c.hp.max}`,
              rp: `${c.rp.current}/${c.rp.max}`,
            }
          : null,
        health: pc ? null : healthBand(c),
        conditions: c.conditions.map((k) =>
          k.rounds === null ? k.name : `${k.name} (${k.rounds})`,
        ),
      };
    }),
  };
}
