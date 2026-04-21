import { desc, eq } from 'drizzle-orm';

import { GmImage } from '../../core/entities/gm-image.js';
import { db, schema } from '../db/index.js';

type Row = typeof schema.gmImages.$inferSelect;

const map = (r: Row): GmImage =>
  GmImage.rehydrate({
    id: r.id,
    filename: r.filename,
    url: r.url,
    alt: r.alt,
    mime: r.mime,
    size: r.size,
    createdAt: r.createdAt ? new Date(r.createdAt) : null,
  });

export class GmImageDrizzleRepository {
  async create(img: GmImage): Promise<GmImage> {
    const [r] = await db
      .insert(schema.gmImages)
      .values({
        filename: img.props.filename,
        url: img.props.url,
        alt: img.props.alt ?? null,
        mime: img.props.mime,
        size: img.props.size,
      })
      .returning();
    return map(r);
  }

  async list(): Promise<GmImage[]> {
    const rows = await db.select().from(schema.gmImages).orderBy(desc(schema.gmImages.createdAt));
    return rows.map(map);
  }

  async findById(id: number): Promise<GmImage | null> {
    const [r] = await db.select().from(schema.gmImages).where(eq(schema.gmImages.id, id));
    return r ? map(r) : null;
  }

  async delete(id: number): Promise<void> {
    await db.delete(schema.gmImages).where(eq(schema.gmImages.id, id));
  }
}
