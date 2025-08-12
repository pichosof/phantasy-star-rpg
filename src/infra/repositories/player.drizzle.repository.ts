import { eq } from 'drizzle-orm';

import { Player } from '../../core/entities/player.js';
import type { IPlayerRepository } from '../../core/repositories/player.repository.js';
import { db, schema } from '../db/index.js';

export class PlayerDrizzleRepository implements IPlayerRepository {
  async create(player: Player): Promise<Player> {
    const [row] = await db
      .insert(schema.players)
      .values({
        name: player['name'],
        level: player['level'],
        background: player['background'] ?? null,
      })
      .returning();
    return Player.rehydrate(row);
  }

  async list(): Promise<Player[]> {
    const rows = await db.select().from(schema.players).orderBy(schema.players.id);
    return rows.map((r) => Player.rehydrate(r));
  }
  async update(id: number, data: { name?: string; level?: number; background?: string | null }) {
    await db
      .update(schema.players)
      .set({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.level !== undefined ? { level: data.level } : {}),
        ...(data.background !== undefined ? { background: data.background } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.players.id, id));
  }

  async updateImage(
    id: number,
    data: { url: string; alt?: string | null; mime?: string | null; size?: number | null },
  ) {
    await db
      .update(schema.players)
      .set({
        imageUrl: data.url,
        imageAlt: data.alt ?? null,
        imageMime: data.mime ?? null,
        imageSize: data.size ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.players.id, id));
  }

  async updateSheet(id: number, data: { url: string; mime?: string | null; size?: number | null }) {
    await db
      .update(schema.players)
      .set({
        sheetUrl: data.url,
        sheetMime: data.mime ?? null,
        sheetSize: data.size ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.players.id, id));
  }
}
