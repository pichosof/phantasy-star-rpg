import { eq } from 'drizzle-orm';

import type {
  DiscordLink,
  DiscordLinkRepository,
} from '../../core/use-cases/discord-links/discord-links.js';
import { db, schema as s } from '../db/index.js';

const columns = {
  discordUserId: s.discordLinks.discordUserId,
  playerId: s.discordLinks.playerId,
  sheetId: s.discordLinks.sheetId,
};

export class DiscordLinkDrizzleRepository implements DiscordLinkRepository {
  async get(discordUserId: string): Promise<DiscordLink | null> {
    const [r] = await db
      .select(columns)
      .from(s.discordLinks)
      .where(eq(s.discordLinks.discordUserId, discordUserId));
    return r ?? null;
  }

  list(): Promise<DiscordLink[]> {
    return db.select(columns).from(s.discordLinks);
  }

  async set(link: DiscordLink) {
    await db
      .insert(s.discordLinks)
      .values(link)
      .onConflictDoUpdate({
        target: s.discordLinks.discordUserId,
        set: { playerId: link.playerId, sheetId: link.sheetId },
      });
  }

  async delete(discordUserId: string) {
    const res = await db
      .delete(s.discordLinks)
      .where(eq(s.discordLinks.discordUserId, discordUserId));
    return res.changes > 0;
  }

  async playerExists(playerId: number) {
    const [r] = await db
      .select({ id: s.players.id })
      .from(s.players)
      .where(eq(s.players.id, playerId));
    return Boolean(r);
  }

  async sheetType(sheetId: number) {
    const [r] = await db
      .select({ type: s.characterSheets.type })
      .from(s.characterSheets)
      .where(eq(s.characterSheets.id, sheetId));
    return r?.type ?? null;
  }
}
