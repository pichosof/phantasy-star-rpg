import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text, primaryKey } from 'drizzle-orm/sqlite-core';

export const players = sqliteTable('players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  level: integer('level').notNull().default(1),
  background: text('background'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

export const questStatus = ['active', 'completed', 'failed'] as const;
export type QuestStatus = (typeof questStatus)[number];

export const quests = sqliteTable('quests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  status: text('status', { enum: questStatus }).notNull().default('active'),
  description: text('description'),
  reward: text('reward'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

export const npcs = sqliteTable('npcs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  role: text('role'), // merchant, quest giver, enemy, etc.
  imageUrl: text('image_url'), // URL pública (ex.: /files/<nome>.png)
  imageAlt: text('image_alt'), // alt text
  imageMime: text('image_mime'), // opcional
  imageSize: integer('image_size'), // bytes (opcional)
  description: text('description'),
  location: text('location'), // cidade/local atual
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

// Sessions (resumo de cada sessão)
export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  date: text('date').notNull(), // ISO string ou "in-game"
  summary: text('summary'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

// Lore (enciclopédia do mundo)
export const loreCategories = ['history', 'culture', 'tech', 'biology', 'myth'] as const;
export type LoreCategory = (typeof loreCategories)[number];

export const lores = sqliteTable('lores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  category: text('category', { enum: loreCategories }),
  content: text('content'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch('now'))`),
});

// Cidades
export const cities = sqliteTable('cities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  region: text('region'),
  description: text('description'),
  coordinates: text('coordinates'),
  discovered: integer('discovered', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch('now'))`),
  worldId: integer('world_id').references(() => worlds.id, { onDelete: 'set null' }),
});

// Bestiário (monstros/inimigos)
export const bestiary = sqliteTable('bestiary', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type'),
  habitat: text('habitat'),
  imageUrl: text('image_url'),
  imageAlt: text('image_alt'),
  imageMime: text('image_mime'),
  imageSize: integer('image_size'),
  weaknesses: text('weaknesses'),
  description: text('description'),
  discovered: integer('discovered', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

// Mapa Interativo (pontos marcados)
export const mapMarkerTypes = ['city', 'dungeon', 'npc', 'poi'] as const;
export type MapMarkerType = (typeof mapMarkerTypes)[number];

export const mapMarkers = sqliteTable('map_markers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type', { enum: mapMarkerTypes }),
  coordinates: text('coordinates'), // "x,y" / "lat,lng" / "tileX,tileY"
  description: text('description'),
  discovered: integer('discovered', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

// Linha do Tempo
export const timelineEvents = sqliteTable('timeline_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  date: text('date').notNull(), // data in-game ou real
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

export const worlds = sqliteTable('worlds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  // imagem do mapa
  imageUrl: text('image_url'),
  imageAlt: text('image_alt'),
  imageMime: text('image_mime'),
  imageSize: integer('image_size'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch('now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch('now'))`),
});

export const playerQuests = sqliteTable(
  'player_quests',
  {
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    questId: integer('quest_id')
      .notNull()
      .references(() => quests.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['assigned', 'completed', 'failed'] })
      .notNull()
      .default('assigned'),
    assignedAt: integer('assigned_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.playerId, t.questId] }) }),
);

export const questCities = sqliteTable(
  'quest_cities',
  {
    questId: integer('quest_id')
      .notNull()
      .references(() => quests.id, { onDelete: 'cascade' }),
    cityId: integer('city_id')
      .notNull()
      .references(() => cities.id, { onDelete: 'cascade' }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.questId, t.cityId] }) }),
);

export const loreCities = sqliteTable(
  'lore_cities',
  {
    loreId: integer('lore_id')
      .notNull()
      .references(() => lores.id, { onDelete: 'cascade' }),
    cityId: integer('city_id')
      .notNull()
      .references(() => cities.id, { onDelete: 'cascade' }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.loreId, t.cityId] }) }),
);
