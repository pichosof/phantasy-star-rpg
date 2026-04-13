import { eq } from 'drizzle-orm';

import { City } from '../../core/entities/city.js';
import { db, schema } from '../db/index.js';
type Row = typeof schema.cities.$inferSelect;
const map = (r: Row) => City.rehydrate(r);

export class CityDrizzleRepository {
  async create(c: City) {
    const [r] = await db
      .insert(schema.cities)
      .values({
        name: c.props.name,
        region: c.props.region ?? null,
        description: c.props.description ?? null,
        discovered: !!c.props.discovered,
      })
      .returning();
    return map(r);
  }
  async setVisibility(id: number, visible: boolean) {
    await db
      .update(schema.cities)
      .set({ visible, updatedAt: new Date() })
      .where(eq(schema.cities.id, id));
  }

  async list() {
    const rows = await db.select().from(schema.cities).orderBy(schema.cities.id);
    return rows.map(map);
  }

  async setDiscovered(id: number, discovered: boolean) {
    await db.update(schema.cities).set({ discovered: discovered }).where(eq(schema.cities.id, id));
  }

  async updateImage(
    id: number,
    data: { url: string; alt?: string | null; mime?: string | null; size?: number | null },
  ) {
    await db
      .update(schema.cities)
      .set({
        imageUrl: data.url,
        imageAlt: data.alt ?? null,
        imageMime: data.mime ?? null,
        imageSize: data.size ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.cities.id, id));
  }

  async delete(id: number) {
    await db.delete(schema.cities).where(eq(schema.cities.id, id));
  }

  async setWorld(cityId: number, worldId: number | null) {
    await db
      .update(schema.cities)
      .set({ worldId, updatedAt: new Date() })
      .where(eq(schema.cities.id, cityId));
  }

  async update(
    id: number,
    data: {
      name?: string;
      description?: string | null;
      discovered?: boolean;
      coordinates?: string | null;
      imageUrl?: string | null;
      imageAlt?: string | null;
      worldId?: number | null;
    },
  ) {
    await db
      .update(schema.cities)
      .set({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.discovered !== undefined ? { discovered: data.discovered } : {}),
        ...(data.coordinates !== undefined ? { coordinates: data.coordinates } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
        ...(data.imageAlt !== undefined ? { imageAlt: data.imageAlt } : {}),
        ...(data.worldId !== undefined ? { worldId: data.worldId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.cities.id, id));
  }
}
