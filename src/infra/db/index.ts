import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { env } from '../config/env.js';

import * as schema from './schema.js';

fs.mkdirSync(path.dirname(path.resolve(env.DATABASE_URL)), { recursive: true });
const sqlite = new Database(env.DATABASE_URL, { fileMustExist: false });

/**
 * Production does not run migrations: tables added later are created here, idempotently.
 * Also called after a backup restore, since an older backup may predate them.
 */
export function ensureRuntimeTables() {
  sqlite.exec(`
  CREATE TABLE IF NOT EXISTS image_focus (
    key TEXT PRIMARY KEY NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );
  CREATE TABLE IF NOT EXISTS encounters (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL,
    session_id INTEGER REFERENCES sessions(id) ON UPDATE NO ACTION ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active',
    state TEXT NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );
  CREATE TABLE IF NOT EXISTS monster_stat_blocks (
    monster_id INTEGER PRIMARY KEY NOT NULL REFERENCES bestiary(id) ON UPDATE NO ACTION ON DELETE CASCADE,
    blocks TEXT NOT NULL DEFAULT '[]',
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );
  CREATE TABLE IF NOT EXISTS session_diaries (
    session_id INTEGER PRIMARY KEY NOT NULL REFERENCES sessions(id) ON UPDATE NO ACTION ON DELETE CASCADE,
    notes TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );
  CREATE TABLE IF NOT EXISTS player_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    player_id INTEGER NOT NULL REFERENCES players(id) ON UPDATE NO ACTION ON DELETE CASCADE,
    session_id INTEGER REFERENCES sessions(id) ON UPDATE NO ACTION ON DELETE SET NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    credits INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );
`);
}

/**
 * On boot the DB file (Azure Files in production) may still be locked by the previous
 * revision during a rollout. Creating tables needs a write lock, so a failure here must not
 * kill the process (the new revision would never become healthy and the old one would never
 * release the file). Retry in the background until it works.
 */
function ensureRuntimeTablesWithRetry(attempt = 1) {
  try {
    ensureRuntimeTables();
    if (attempt > 1) console.info(`[db] runtime tables ready (attempt ${attempt})`);
  } catch (e) {
    const delay = Math.min(60_000, 2_000 * attempt);
    console.warn(
      `[db] runtime tables not created yet (${(e as Error).message}); retrying in ${delay / 1000}s`,
    );
    setTimeout(() => ensureRuntimeTablesWithRetry(attempt + 1), delay).unref();
  }
}
ensureRuntimeTablesWithRetry();

export const db = drizzle(sqlite, { schema });
/** Raw better-sqlite3 handle — only for ops tasks like online backups. */
export { sqlite, schema };
