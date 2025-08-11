import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { beforeAll, beforeEach } from 'vitest';

import { db, schema } from '../src/infra/db';

beforeAll(() => {
  migrate(db, { migrationsFolder: 'drizzle/migrations' });
});

beforeEach(async () => {
  await db.delete(schema.players);
  await db.delete(schema.quests);
});
