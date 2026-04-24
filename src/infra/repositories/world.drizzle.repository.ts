import { eq } from 'drizzle-orm';

import { World } from '../../core/entities/world';
import { db, schema } from '../db/index.js';

type Row = typeof schema.worlds.$inferSelect;

const map = (r: Row) =>
  World.rehydrate({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    imageUrl: r.imageUrl ?? null,
    imageAlt: r.imageAlt ?? null,
    imageMime: r.imageMime ?? null,
    imageSize: r.imageSize ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  });

export class WorldDrizzleRepository {
  async create(p: { name: string; description?: string | null }) {
    const [row] = await db
      .insert(schema.worlds)
      .values({
        name: p.name,
        description: p.description ?? null,
      })
      .returning();
    return map(row);
  }

  async list() {
    const rows = await db.select().from(schema.worlds).orderBy(schema.worlds.id);
    return rows.map(map);
  }

  async findById(id: number) {
    const [row] = await db.select().from(schema.worlds).where(eq(schema.worlds.id, id));
    return row ?? null;
  }

  async updateImage(
    id: number,
    data: { url: string; alt?: string | null; mime?: string | null; size?: number | null },
  ) {
    await db
      .update(schema.worlds)
      .set({
        imageUrl: data.url,
        imageAlt: data.alt ?? null,
        imageMime: data.mime ?? null,
        imageSize: data.size ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.worlds.id, id));
  }
  async setVisibility(id: number, visible: boolean) {
    await db
      .update(schema.worlds)
      .set({ visible, updatedAt: new Date() })
      .where(eq(schema.worlds.id, id));
  }
  async update(id: number, data: { name?: string; description?: string | null }) {
    await db
      .update(schema.worlds)
      .set({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.worlds.id, id));
  }
}
