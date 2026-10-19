import { z } from 'zod';

import { Encounter } from '../../entities/encounter.js';

import { emptyEncounterState, encounterStateSchema } from './encounter-state.js';
import type { EncounterRepository } from './encounter.repository.js';
import { EncounterConflictError, EncounterNotFoundError } from './errors.js';

export const createEncounterInput = z.object({
  name: z.string().trim().min(1).max(120),
  sessionId: z.number().int().positive().nullish(),
  state: encounterStateSchema.optional(),
});
export type CreateEncounterInput = z.infer<typeof createEncounterInput>;

export const saveEncounterInput = z.object({
  /** Version the client started from. */
  version: z.number().int().min(1),
  /** Skip the version check (explicit "keep my copy" after a conflict). */
  force: z.boolean().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  sessionId: z.number().int().positive().nullable().optional(),
  status: z.enum(['active', 'ended']).optional(),
  state: encounterStateSchema.optional(),
});
export type SaveEncounterInput = z.infer<typeof saveEncounterInput>;

export class CreateEncounter {
  constructor(private repo: EncounterRepository) {}
  execute(input: CreateEncounterInput) {
    const parsed = createEncounterInput.parse(input);
    return this.repo.create(
      Encounter.create({
        name: parsed.name,
        sessionId: parsed.sessionId ?? null,
        state: parsed.state ?? emptyEncounterState(),
      }),
    );
  }
}

export class ListEncounters {
  constructor(private repo: EncounterRepository) {}
  execute() {
    return this.repo.list();
  }
}

export class GetEncounter {
  constructor(private repo: EncounterRepository) {}
  async execute(id: number) {
    const found = await this.repo.findById(id);
    if (!found) throw new EncounterNotFoundError(id);
    return found;
  }
}

/** Saves with optimistic concurrency so two devices never silently overwrite each other. */
export class SaveEncounter {
  constructor(private repo: EncounterRepository) {}
  async execute(id: number, input: SaveEncounterInput) {
    const { version, force, ...changes } = saveEncounterInput.parse(input);
    const current = await this.repo.findById(id);
    if (!current) throw new EncounterNotFoundError(id);
    const expected = force ? current.props.version : version;
    if (expected !== current.props.version) throw new EncounterConflictError(current.props.version);
    const saved = await this.repo.saveIfVersion(id, expected, changes);
    if (!saved) {
      const latest = await this.repo.findById(id);
      throw new EncounterConflictError(latest?.props.version ?? expected);
    }
    return saved;
  }
}

export class DeleteEncounter {
  constructor(private repo: EncounterRepository) {}
  execute(id: number) {
    return this.repo.delete(id);
  }
}
