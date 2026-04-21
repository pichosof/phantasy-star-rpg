#!/usr/bin/env node
// Run: node scripts/migrate-dungeons-tags.js
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '..', 'data', 'app.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const migrations = [
  `CREATE TABLE IF NOT EXISTS dungeons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT,
    description TEXT,
    region TEXT,
    coordinates TEXT,
    discovered INTEGER NOT NULL DEFAULT 0,
    visible INTEGER NOT NULL DEFAULT 0,
    city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
    world_id INTEGER REFERENCES worlds(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  )`,

  `CREATE TABLE IF NOT EXISTS dungeon_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dungeon_id INTEGER NOT NULL REFERENCES dungeons(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    alt TEXT,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  )`,

  `CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#1677ff',
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  )`,

  `CREATE TABLE IF NOT EXISTS entity_tags (
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    PRIMARY KEY (tag_id, entity_type, entity_id)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_entity_tags_entity ON entity_tags(entity_type, entity_id)`,
];

for (const sql of migrations) {
  db.exec(sql);
  console.log('OK:', sql.slice(0, 60).trim());
}

db.close();
console.log('\nMigration complete.');
