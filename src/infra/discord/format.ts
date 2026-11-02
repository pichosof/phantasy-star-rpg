import type { APIActionRowComponent, APIButtonComponent, APIEmbed } from 'discord.js';

import type { EntityType } from '../../core/use-cases/links/link-text.js';
import { type DiscordConfig, env } from '../config/env.js';

/** What a command answers with: plain Discord API JSON, so handlers stay testable. */
export interface BotReply {
  content?: string;
  embeds?: APIEmbed[];
  components?: APIActionRowComponent<APIButtonComponent>[];
  /** Only the caller sees it. */
  ephemeral?: boolean;
}

export const COLOR = {
  brand: 0x2f6fdb,
  success: 0x2e9e5b,
  danger: 0xd04545,
  gold: 0xd4a72c,
  muted: 0x6b7280,
} as const;

export const TYPE_LABEL: Record<EntityType, string> = {
  city: 'City',
  npc: 'NPC',
  player: 'Character',
  dungeon: 'Dungeon',
  world: 'World',
  quest: 'Quest',
  session: 'Session',
  lore: 'Lore',
  wiki: 'Wiki',
  beast: 'Creature',
  timeline: 'Timeline',
  gmNote: 'GM note',
  item: 'Item',
};

export const TYPE_ICON: Record<EntityType, string> = {
  city: '🏙️',
  npc: '🧑',
  player: '🛡️',
  dungeon: '🕳️',
  world: '🪐',
  quest: '📜',
  session: '🎲',
  lore: '📖',
  wiki: '📚',
  beast: '🦂',
  timeline: '⏳',
  gmNote: '🔒',
  item: '🎒',
};

/** What the subtitle of each type means (shown as a field). */
export const SUBTITLE_LABEL: Partial<Record<EntityType, string>> = {
  city: 'Region',
  npc: 'Role',
  dungeon: 'Type',
  quest: 'Status',
  lore: 'Category',
  wiki: 'Category',
  beast: 'Type',
  session: 'Date',
  timeline: 'Date',
  item: 'Kind',
};

const PAGE: Record<EntityType, string> = {
  city: '/cities',
  npc: '/npcs',
  player: '/players',
  dungeon: '/dungeons',
  world: '/worlds',
  quest: '/quests',
  session: '/sessions',
  lore: '/lores',
  wiki: '/wiki',
  beast: '/monsters',
  timeline: '/timeline',
  gmNote: '/gm/notes',
  item: '/items',
};

/** The bot's validated config; using a bot formatter without it is a bug, not a default. */
export function discord(): DiscordConfig {
  if (!env.DISCORD) throw new Error('Discord is not configured (DISCORD_TOKEN is empty)');
  return env.DISCORD;
}

export const siteUrl = (type: EntityType) => `${discord().siteUrl}${PAGE[type]}`;

/** The site's icon (Dezolis mark), as published by the front end. */
export const brandIcon = () => `${discord().siteUrl}/logo192.png`;

/** Puts the site icon next to every card header (image-only mosaic embeds have no header). */
export function branded(embeds: APIEmbed[] | undefined): APIEmbed[] | undefined {
  return embeds?.map((e) =>
    e.author && !e.author.icon_url ? { ...e, author: { ...e.author, icon_url: brandIcon() } } : e,
  );
}

export class UnsupportedImageUrlError extends Error {
  constructor(url: string) {
    super(`Unsupported image URL: ${url}`);
  }
}

/**
 * Absolute image URL Discord can fetch; uploads get a 640px thumbnail. No image → undefined;
 * a URL in an unknown format throws instead of silently dropping the picture.
 */
export function imageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('/files/'))
    return `${discord().publicApiUrl}${url}${url.includes('?') ? '' : '?w=640'}`;
  if (/^https?:\/\//.test(url)) return url;
  throw new UnsupportedImageUrlError(url);
}

const LINK_RE = /\[\[([^[\]|\n]{1,120})(?:\|([^[\]\n]{1,120}))?\]\]/g;

/** Site Markdown → Discord Markdown: wiki links become bold, images and HTML go away. */
export function toDiscordMarkdown(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(
      LINK_RE,
      (_, name: string, label?: string) => `**${(label ?? name.replace(/^\w+:/, '')).trim()}**`,
    )
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^#{4,6}\s+/gm, '### ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Cuts at a paragraph/line/word boundary under `max` characters. */
export function truncate(text: string, max: number, more = '…'): string {
  if (text.length <= max) return text;
  const room = max - more.length;
  const cut = text.slice(0, room);
  const at = Math.max(cut.lastIndexOf('\n\n'), cut.lastIndexOf('\n'), cut.lastIndexOf(' '));
  return `${(at > room * 0.6 ? cut.slice(0, at) : cut).trimEnd()}${more}`;
}

export const linkButton = (
  label: string,
  url: string,
): APIActionRowComponent<APIButtonComponent> => ({
  type: 1,
  components: [{ type: 2, style: 5, label, url }],
});

export const errorReply = (message: string): BotReply => ({
  embeds: [{ color: COLOR.danger, description: message }],
  ephemeral: true,
});
