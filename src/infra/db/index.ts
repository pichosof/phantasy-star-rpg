import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { env } from '../config/env.js';

import * as schema from './schema.js';

const sqlite = new Database(env.DATABASE_URL, { fileMustExist: false });
export const db = drizzle(sqlite, { schema });
export { schema };
