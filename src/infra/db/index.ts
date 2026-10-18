import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { env } from '../config/env.js';

import * as schema from './schema.js';

const sqlite = new Database(env.DATABASE_URL, { fileMustExist: false });

// Tables added after the last migration snapshot; idempotent so it is safe on every boot.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS image_focus (
    key TEXT PRIMARY KEY NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  )
`);

export const db = drizzle(sqlite, { schema });
/** Raw better-sqlite3 handle — only for ops tasks like online backups. */
export { sqlite, schema };
