import { eq } from 'drizzle-orm';

import { Lore } from '../../core/entities/lore.js';
import { db, schema } from '../db/index.js';
type Row = typeof schema.lores.$inferSelect;
const map = (r: Row) =>
  Lore.rehydrate({
    id: r.id,
    title: r.title,
    category: r.category ?? null,
    content: r.content ?? null,
    createdAt: r.createdAt,
  });
export class LoreDrizzleRepository {
  async create(l: Lore) {
    const [r] = await db
      .insert(schema.lores)
      .values({
        title: l.props.title,
        category: l.props.category,
        content: l.props.content ?? null,
      })
      .returning();
    return map(r);
  }

  async list() {
    const rows = await db.select().from(schema.lores).orderBy(schema.lores.id);
    return rows.map(map);
  }

  async delete(id: number) {
    await db.delete(schema.lores).where(eq(schema.lores.id, id));
  }
  async update(
    id: number,
    data: {
      title?: string;
      category?: 'history' | 'culture' | 'tech' | 'biology' | 'myth' | null;
      content?: string | null;
    },
  ) {
    await db
      .update(schema.lores)
      .set({
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.lores.id, id));
  }
}
