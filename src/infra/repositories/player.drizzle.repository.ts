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
}
