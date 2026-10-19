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
  )
`);
}
ensureRuntimeTables();

export const db = drizzle(sqlite, { schema });
/** Raw better-sqlite3 handle — only for ops tasks like online backups. */
export { sqlite, schema };
