import { getTableName, is } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { beforeAll, beforeEach } from 'vitest';

import { db, ensureRuntimeTables, schema, sqlite } from '../src/infra/db';

const tables = Object.values(schema)
  .filter((t): t is SQLiteTable => is(t, SQLiteTable))
  .map((t) => getTableName(t));

beforeAll(() => {
  migrate(db, { migrationsFolder: 'drizzle/migrations' });
  // Runtime columns on migrated tables (e.g. npcs.race) need the tables to exist first.
  ensureRuntimeTables();
});

// Every test starts from an empty database.
beforeEach(() => {
  sqlite.pragma('foreign_keys = OFF');
  sqlite.transaction(() => {
    for (const name of tables) sqlite.prepare(`DELETE FROM "${name}"`).run();
  })();
  sqlite.pragma('foreign_keys = ON');
});
