import * as dotenv from 'dotenv';
dotenv.config();

function required(name: string, def?: string) {
  const v = process.env[name] ?? def;
  if (v === undefined) throw new Error(`Missing env var: ${name}`);
  return v;
}

const NODE_ENV = required('NODE_ENV', 'development');
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

export const env = {
  PORT: Number(required('PORT', '3000')),
  NODE_ENV,
  DATABASE_URL: required('DATABASE_URL', './data/app.db'),
  CORS_ORIGIN,
  /** Parsed allow-list from the comma-separated CORS_ORIGIN (trailing slashes removed). */
  CORS_ORIGINS: CORS_ORIGIN.split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),
  FILE_STORAGE_DRIVER: required('FILE_STORAGE_DRIVER', 'local'),
  UPLOADS_LOCAL_DIR: required('UPLOADS_LOCAL_DIR', './data/uploads'),
  AZURE_STORAGE_CONNECTION_STRING: process.env.AZURE_STORAGE_CONNECTION_STRING ?? '',
  AZURE_STORAGE_CONTAINER: required('AZURE_STORAGE_CONTAINER', 'uploads'),
  AZURE_STORAGE_ACCESS_TIER: required('AZURE_STORAGE_ACCESS_TIER', 'Cool'),

  // ── SQLite backups ──
  // Enabled by default in production only. Target follows FILE_STORAGE_DRIVER:
  // a private Blob container for azure-blob, a local directory otherwise.
  BACKUP_ENABLED: (process.env.BACKUP_ENABLED ?? String(NODE_ENV === 'production')) === 'true',
  BACKUP_INTERVAL_HOURS: Number(required('BACKUP_INTERVAL_HOURS', '6')),
  BACKUP_RETENTION: Number(required('BACKUP_RETENTION', '30')),
  AZURE_BACKUP_CONTAINER: required('AZURE_BACKUP_CONTAINER', 'db-backups'),
  BACKUP_LOCAL_DIR: required('BACKUP_LOCAL_DIR', './data/backups'),

  // ── AI session diary (optional: without a key the feature is simply off) ──
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-5-5',

  /** Commit this process runs (set by the deploy); health reports it so the deploy can tell
   *  the new revision from the old one. Empty locally. */
  APP_VERSION: process.env.APP_VERSION ?? '',

  // ── Discord bot: off without DISCORD_TOKEN; with it, the rest is required (no defaults) ──
  DISCORD: readDiscordConfig(process.env),

  // ── NPC portraits (Fotor): off without FOTOR_API_KEY; with it, the rest is required ──
  FOTOR: readFotorConfig(process.env),
};

export type DiscordConfig = NonNullable<ReturnType<typeof readDiscordConfig>>;

type Source = Record<string, string | undefined>;

/** Readers for a feature switched on by `switchName`: every other setting is required. */
function settings(source: Source, switchName: string) {
  const need = (name: string) => {
    const value = source[name]?.trim();
    if (!value) throw new Error(`Missing env var: ${name} (required when ${switchName} is set)`);
    return value;
  };
  const url = (name: string) => {
    const value = need(name);
    const parsed = new URL(value); // throws on a malformed URL
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
      throw new Error(`${name} must be an http(s) URL`);
    return value.replace(/\/$/, '');
  };
  return { need, url };
}

/** Null when DISCORD_TOKEN is empty (bot off). Otherwise every setting is required: no defaults. */
export function readDiscordConfig(source: Source) {
  const token = source.DISCORD_TOKEN ?? '';
  if (!token) return null;
  const { need, url } = settings(source, 'DISCORD_TOKEN');
  const announce = source.DISCORD_ANNOUNCE_CHANNEL_ID;
  if (announce === undefined)
    throw new Error(
      'Missing env var: DISCORD_ANNOUNCE_CHANNEL_ID (set it empty to turn announcements off)',
    );
  return {
    token,
    /** Servers where the slash commands are registered (comma-separated). */
    guildIds: need('DISCORD_GUILD_IDS')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    /** Discord user ids with GM powers in the bot. */
    gmUserIds: need('DISCORD_GM_USER_IDS')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    /** Channel for reveal announcements; explicitly empty = announcements off. */
    announceChannelId: announce.trim(),
    /** Front-end URL for "Open on site" links. */
    siteUrl: url('SITE_URL'),
    /** Public URL of this API, to turn uploaded `/files/...` images into absolute links. */
    publicApiUrl: url('PUBLIC_API_URL'),
  };
}

export type FotorConfig = NonNullable<ReturnType<typeof readFotorConfig>>;

/** Null when FOTOR_API_KEY is empty (portraits off). Otherwise every setting is required. */
export function readFotorConfig(source: Source) {
  const apiKey = source.FOTOR_API_KEY ?? '';
  if (!apiKey) return null;
  const { need, url } = settings(source, 'FOTOR_API_KEY');
  const webhookSecret = need('FOTOR_WEBHOOK_SECRET');
  if (webhookSecret.length < 24)
    throw new Error('FOTOR_WEBHOOK_SECRET must be at least 24 characters (it guards the webhook)');
  return {
    apiKey,
    /** Path segment of the completion webhook: /hooks/fotor/<secret>. */
    webhookSecret,
    /** Public URL of this API: Fotor fetches the reference images from `/files/...` there. */
    publicApiUrl: url('PUBLIC_API_URL'),
  };
}
