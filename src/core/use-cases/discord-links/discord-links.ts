import { z } from 'zod';

/** A Discord user played by one player character, with the sheet their rolls use. */
export interface DiscordLink {
  discordUserId: string;
  playerId: number;
  /** Character sheet for /check, /save, /attack… (null = the player has no sheet linked yet). */
  sheetId: number | null;
}

export interface DiscordLinkRepository {
  get(discordUserId: string): Promise<DiscordLink | null>;
  list(): Promise<DiscordLink[]>;
  /** Insert or replace the link of this Discord user. */
  set(link: DiscordLink): Promise<void>;
  delete(discordUserId: string): Promise<boolean>;
  playerExists(playerId: number): Promise<boolean>;
  sheetType(sheetId: number): Promise<string | null>;
}

export class DiscordLinkError extends Error {
  readonly statusCode = 400;
}

export const discordLinkInput = z.object({
  discordUserId: z.string().regex(/^\d{5,25}$/, 'Not a Discord user id'),
  playerId: z.number().int().positive(),
  sheetId: z.number().int().positive().nullable(),
});

export class LinkDiscordUser {
  constructor(private repo: DiscordLinkRepository) {}
  async execute(input: unknown): Promise<DiscordLink> {
    const link = discordLinkInput.parse(input);
    if (!(await this.repo.playerExists(link.playerId)))
      throw new DiscordLinkError(`Player ${link.playerId} does not exist.`);
    if (link.sheetId !== null) {
      const type = await this.repo.sheetType(link.sheetId);
      if (type === null) throw new DiscordLinkError(`Sheet ${link.sheetId} does not exist.`);
      if (type !== 'starfinder')
        throw new DiscordLinkError(
          `Sheet ${link.sheetId} is a ${type} sheet; rolls need Starfinder.`,
        );
    }
    await this.repo.set(link);
    return link;
  }
}

export class GetDiscordLink {
  constructor(private repo: DiscordLinkRepository) {}
  execute(discordUserId: string) {
    return this.repo.get(discordUserId);
  }
}

export class ListDiscordLinks {
  constructor(private repo: DiscordLinkRepository) {}
  execute() {
    return this.repo.list();
  }
}

export class UnlinkDiscordUser {
  constructor(private repo: DiscordLinkRepository) {}
  execute(discordUserId: string) {
    return this.repo.delete(discordUserId);
  }
}
