import { z } from 'zod';

/** Current / max pool (Stamina, Hit Points, Resolve). */
const pool = z.object({
  current: z.number().int().min(-9999).max(99999),
  max: z.number().int().min(0).max(99999),
});

export const conditionSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(60),
  /** Rounds left; null = until removed. */
  rounds: z.number().int().min(0).max(999).nullable(),
});

export const combatantSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(['pc', 'monster', 'npc']),
  name: z.string().min(1).max(120),
  /** character_sheets.id for PCs, bestiary.id for monsters. */
  refId: z.number().int().nullable().optional(),
  imageUrl: z.string().max(1000).nullable().optional(),
  initiative: z.number().int().min(-99).max(999).nullable(),
  initBonus: z.number().int().min(-99).max(99),
  sp: pool,
  hp: pool,
  rp: pool,
  eac: z.number().int().min(0).max(99).nullable().optional(),
  kac: z.number().int().min(0).max(99).nullable().optional(),
  conditions: z.array(conditionSchema).max(30),
  notes: z.string().max(2000).nullable().optional(),
  defeated: z.boolean(),
});

export const logEntrySchema = z.object({
  id: z.string().min(1).max(64),
  round: z.number().int().min(0),
  text: z.string().min(1).max(300),
  at: z.string().max(40),
});

/** Combatants are stored in turn order; `turn` indexes into that array. */
export const encounterStateSchema = z.object({
  round: z.number().int().min(0).max(9999),
  turn: z.number().int().min(0).max(99),
  combatants: z.array(combatantSchema).max(60),
  log: z.array(logEntrySchema).max(500),
});

export type EncounterState = z.infer<typeof encounterStateSchema>;
export type Combatant = z.infer<typeof combatantSchema>;

export const emptyEncounterState = (): EncounterState => ({
  round: 0,
  turn: 0,
  combatants: [],
  log: [],
});
