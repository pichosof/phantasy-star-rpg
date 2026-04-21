import { desc, eq } from 'drizzle-orm';

import { CharacterSheet } from '../../core/entities/character-sheet.js';
import { db, schema } from '../db/index.js';

type Row = typeof schema.characterSheets.$inferSelect;

const map = (r: Row): CharacterSheet =>
  CharacterSheet.rehydrate({
    id: r.id,
    type: r.type,
    name: r.name,
    data: JSON.parse(r.data || '{}') as Record<string, unknown>,
    createdAt: r.createdAt ? new Date(r.createdAt) : null,
    updatedAt: r.updatedAt ? new Date(r.updatedAt) : null,
  });

export class CharacterSheetDrizzleRepository {
  async create(s: CharacterSheet): Promise<CharacterSheet> {
    const [r] = await db
      .insert(schema.characterSheets)
      .values({
        type: s.props.type,
        name: s.props.name,
        data: JSON.stringify(s.props.data ?? {}),
      })
      .returning();
    return map(r);
  }

  async list(type?: string): Promise<CharacterSheet[]> {
    const rows = await db
      .select()
      .from(schema.characterSheets)
      .orderBy(desc(schema.characterSheets.updatedAt));
    const all = rows.map(map);
    if (!type) return all;
    return all.filter((s) => s.props.type === type);
  }

  async findById(id: number): Promise<CharacterSheet | null> {
    const [r] = await db
      .select()
      .from(schema.characterSheets)
      .where(eq(schema.characterSheets.id, id));
    return r ? map(r) : null;
  }

  async update(id: number, data: { name?: string; data?: Record<string, unknown> }): Promise<void> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) set.name = data.name;
    if (data.data !== undefined) set.data = JSON.stringify(data.data);
    await db.update(schema.characterSheets).set(set).where(eq(schema.characterSheets.id, id));
  }

  async delete(id: number): Promise<void> {
    await db.delete(schema.characterSheets).where(eq(schema.characterSheets.id, id));
  }
}
