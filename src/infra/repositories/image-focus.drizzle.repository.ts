import { inArray } from 'drizzle-orm';

import { db, schema } from '../db/index.js';

export interface ImageFocus {
  key: string;
  x: number;
  y: number;
}

export class ImageFocusDrizzleRepository {
  async findByKeys(keys: string[]): Promise<ImageFocus[]> {
    if (!keys.length) return [];
    const rows = await db
      .select()
      .from(schema.imageFocus)
      .where(inArray(schema.imageFocus.key, keys));
    return rows.map((r) => ({ key: r.key, x: r.x, y: r.y }));
  }

  async upsert(focus: ImageFocus): Promise<void> {
    await db
      .insert(schema.imageFocus)
      .values({ ...focus, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.imageFocus.key,
        set: { x: focus.x, y: focus.y, updatedAt: new Date() },
      });
  }
}
