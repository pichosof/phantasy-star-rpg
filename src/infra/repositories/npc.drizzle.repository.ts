import { eq } from 'drizzle-orm';

import { Npc } from '../../core/entities/npc.js';
import { db, schema } from '../db/index.js';

type Row = typeof schema.npcs.$inferSelect;
const map = (r: Row) => Npc.rehydrate(r);

export class NpcDrizzleRepository {
  async create(n: Npc) {
    const p = n.toJSON();
    const [r] = await db
      .insert(schema.npcs)
      .values({
        name: p.name,
        role: p.role ?? null,
        description: p.description ?? null,
        location: p.location ?? null,
        imageUrl: p.imageUrl ?? null,
        imageAlt: p.imageAlt ?? null,
        imageMime: p.imageMime ?? null,
        imageSize: p.imageSize ?? null,
      })
      .returning();
    return map(r);
  }

  async list() {
    const rows = await db.select().from(schema.npcs).orderBy(schema.npcs.id);
    return rows.map(map);
  }

  async update(
    id: number,
    data: {
      name?: string;
      role?: string | null;
      description?: string | null;
      location?: string | null;
    },
  ) {
    await db
      .update(schema.npcs)
      .set({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.npcs.id, id));
  }

  async setVisibility(id: number, visible: boolean) {
    await db.update(schema.npcs).set({ visible, updatedAt: new Date() }).where(eq(schema.npcs.id, id));
  }

  async updateImage(id: number, img: { url: string; alt?: string | null; mime?: string; size?: number }) {
    await db
      .update(schema.npcs)
      .set({
        imageUrl: img.url,
        imageAlt: img.alt ?? null,
        imageMime: img.mime ?? null,
        imageSize: img.size ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.npcs.id, id));
  }

  async delete(id: number) {
    await db.delete(schema.npcs).where(eq(schema.npcs.id, id));
  }
}
