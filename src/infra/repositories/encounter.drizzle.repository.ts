import { and, desc, eq } from 'drizzle-orm';

import { Encounter } from '../../core/entities/encounter.js';
import type {
  EncounterChanges,
  EncounterRepository,
} from '../../core/use-cases/encounters/encounter.repository.js';
import { db, schema } from '../db/index.js';

type Row = typeof schema.encounters.$inferSelect;

const parseState = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const map = (r: Row): Encounter =>
  Encounter.rehydrate({
    id: r.id,
    name: r.name,
    sessionId: r.sessionId,
    status: r.status,
    state: parseState(r.state),
    version: r.version,
    createdAt: r.createdAt ? new Date(r.createdAt) : null,
    updatedAt: r.updatedAt ? new Date(r.updatedAt) : null,
  });

export class EncounterDrizzleRepository implements EncounterRepository {
  async create(e: Encounter): Promise<Encounter> {
    const [r] = await db
      .insert(schema.encounters)
      .values({
        name: e.props.name,
        sessionId: e.props.sessionId ?? null,
        status: e.props.status,
        state: JSON.stringify(e.props.state ?? {}),
        version: e.props.version,
      })
      .returning();
    return map(r);
  }

  async list(): Promise<Encounter[]> {
    const rows = await db
      .select()
      .from(schema.encounters)
      .orderBy(desc(schema.encounters.updatedAt));
    return rows.map(map);
  }

  async findById(id: number): Promise<Encounter | null> {
    const [r] = await db.select().from(schema.encounters).where(eq(schema.encounters.id, id));
    return r ? map(r) : null;
  }

  async saveIfVersion(id: number, expectedVersion: number, changes: EncounterChanges) {
    const { state, ...rest } = changes;
    const [r] = await db
      .update(schema.encounters)
      .set({
        ...rest,
        ...(state !== undefined ? { state: JSON.stringify(state) } : {}),
        version: expectedVersion + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.encounters.id, id), eq(schema.encounters.version, expectedVersion)))
      .returning();
    return r ? map(r) : null;
  }

  async delete(id: number): Promise<void> {
    await db.delete(schema.encounters).where(eq(schema.encounters.id, id));
  }
}
