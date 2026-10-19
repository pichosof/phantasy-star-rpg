import type { Encounter, EncounterStatus } from '../../entities/encounter.js';

export interface EncounterChanges {
  name?: string;
  sessionId?: number | null;
  status?: EncounterStatus;
  state?: unknown;
}

export interface EncounterRepository {
  create(e: Encounter): Promise<Encounter>;
  list(): Promise<Encounter[]>;
  findById(id: number): Promise<Encounter | null>;
  /** Applies the changes only if the stored version still equals `expectedVersion`; null on mismatch. */
  saveIfVersion(
    id: number,
    expectedVersion: number,
    changes: EncounterChanges,
  ): Promise<Encounter | null>;
  delete(id: number): Promise<void>;
}
