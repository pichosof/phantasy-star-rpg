import { eq } from 'drizzle-orm';

import { Monster } from '../../core/entities/monster.js';
import { db, schema } from '../db/index.js';
type Row = typeof schema.bestiary.$inferSelect;
const map = (r: Row) => Monster.rehydrate(r);

export class MonsterDrizzleRepository {
  async create(m: Monster) {
    const [r] = await db
      .insert(schema.bestiary)
      .values({
        name: m.props.name,
        type: m.props.type ?? null,
        habitat: m.props.habitat ?? null,
        weaknesses: m.props.weaknesses ?? null,
        description: m.props.description ?? null,
        discovered: !!m.props.discovered,
        imageUrl: m.props.imageUrl ?? null,
        imageAlt: m.props.imageAlt ?? null,
        imageMime: m.props.imageMime ?? null,
        imageSize: m.props.imageSize ?? null,
      })
      .returning();
    return map(r);
  }

  async list() {
    const rows = await db.select().from(schema.bestiary).orderBy(schema.bestiary.id);
    return rows.map(map);
  }

  async setDiscovered(id: number, discovered: boolean) {
    await db
      .update(schema.bestiary)
      .set({ discovered: discovered })
      .where(eq(schema.bestiary.id, id));
  }

  async updateImage(id: number, img: { url: string; alt?: string; mime?: string; size?: number }) {
    await db
      .update(schema.bestiary)
      .set({
        imageUrl: img.url,
        imageAlt: img.alt ?? null,
        imageMime: img.mime ?? null,
        imageSize: img.size ?? null,
      })
      .where(eq(schema.bestiary.id, id));
  }

  async delete(id: number) {
    await db.delete(schema.bestiary).where(eq(schema.bestiary.id, id));
  }
}
