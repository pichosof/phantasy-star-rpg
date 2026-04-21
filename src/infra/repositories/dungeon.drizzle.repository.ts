import { eq, asc } from 'drizzle-orm';

import { db } from '../db/index.js';
import * as s from '../db/schema.js';

type DungeonRow = typeof s.dungeons.$inferSelect;
type DungeonImageRow = typeof s.dungeonImages.$inferSelect;

export type DungeonWithImages = DungeonRow & { images: DungeonImageRow[] };

export class DungeonDrizzleRepository {
  async list(): Promise<DungeonWithImages[]> {
    const rows = await db.select().from(s.dungeons).orderBy(s.dungeons.id);
    const images = await db
      .select()
      .from(s.dungeonImages)
      .orderBy(asc(s.dungeonImages.position), asc(s.dungeonImages.createdAt));
    return rows.map((r) => ({ ...r, images: images.filter((img) => img.dungeonId === r.id) }));
  }

  async findById(id: number): Promise<DungeonWithImages | null> {
    const [row] = await db.select().from(s.dungeons).where(eq(s.dungeons.id, id));
    if (!row) return null;
    const images = await db
      .select()
      .from(s.dungeonImages)
      .where(eq(s.dungeonImages.dungeonId, id))
      .orderBy(asc(s.dungeonImages.position), asc(s.dungeonImages.createdAt));
    return { ...row, images };
  }

  async create(data: {
    name: string;
    type?: string | null;
    description?: string | null;
    region?: string | null;
    coordinates?: string | null;
    cityId?: number | null;
    worldId?: number | null;
  }): Promise<DungeonRow> {
    const [row] = await db
      .insert(s.dungeons)
      .values({
        name: data.name,
        type:
          (data.type as 'cave' | 'tower' | 'ruin' | 'lair' | 'temple' | 'facility' | 'other') ??
          null,
        description: data.description ?? null,
        region: data.region ?? null,
        coordinates: data.coordinates ?? null,
        cityId: data.cityId ?? null,
        worldId: data.worldId ?? null,
      })
      .returning();
    return row;
  }

  async update(
    id: number,
    data: {
      name?: string;
      type?: string | null;
      description?: string | null;
      region?: string | null;
      coordinates?: string | null;
      discovered?: boolean;
      cityId?: number | null;
      worldId?: number | null;
    },
  ): Promise<void> {
    await db
      .update(s.dungeons)
      .set({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.type !== undefined
          ? {
              type: data.type as
                | 'cave'
                | 'tower'
                | 'ruin'
                | 'lair'
                | 'temple'
                | 'facility'
                | 'other',
            }
          : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.region !== undefined ? { region: data.region } : {}),
        ...(data.coordinates !== undefined ? { coordinates: data.coordinates } : {}),
        ...(data.discovered !== undefined ? { discovered: data.discovered } : {}),
        ...(data.cityId !== undefined ? { cityId: data.cityId } : {}),
        ...(data.worldId !== undefined ? { worldId: data.worldId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(s.dungeons.id, id));
  }

  async setVisibility(id: number, visible: boolean): Promise<void> {
    await db
      .update(s.dungeons)
      .set({ visible, updatedAt: new Date() })
      .where(eq(s.dungeons.id, id));
  }

  async setDiscovered(id: number, discovered: boolean): Promise<void> {
    await db
      .update(s.dungeons)
      .set({ discovered, updatedAt: new Date() })
      .where(eq(s.dungeons.id, id));
  }

  async delete(id: number): Promise<void> {
    await db.delete(s.dungeons).where(eq(s.dungeons.id, id));
  }

  async listImages(dungeonId: number): Promise<DungeonImageRow[]> {
    return db
      .select()
      .from(s.dungeonImages)
      .where(eq(s.dungeonImages.dungeonId, dungeonId))
      .orderBy(asc(s.dungeonImages.position), asc(s.dungeonImages.createdAt));
  }

  async addImage(data: {
    dungeonId: number;
    url: string;
    alt?: string | null;
    mime: string;
    size: number;
  }): Promise<DungeonImageRow> {
    const [row] = await db
      .insert(s.dungeonImages)
      .values({
        dungeonId: data.dungeonId,
        url: data.url,
        alt: data.alt ?? null,
        mime: data.mime,
        size: data.size,
      })
      .returning();
    return row;
  }

  async deleteImage(imageId: number): Promise<DungeonImageRow | null> {
    const [row] = await db
      .delete(s.dungeonImages)
      .where(eq(s.dungeonImages.id, imageId))
      .returning();
    return row ?? null;
  }
}
