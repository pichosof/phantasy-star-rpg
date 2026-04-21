import { eq, and, inArray } from 'drizzle-orm';

import { db } from '../db/index.js';
import * as s from '../db/schema.js';

type TagRow = typeof s.tags.$inferSelect;
type EntityTagType = (typeof s.entityTagTypes)[number];

export class TagsDrizzleRepository {
  async listAll(): Promise<TagRow[]> {
    return db.select().from(s.tags).orderBy(s.tags.name);
  }

  async findById(id: number): Promise<TagRow | null> {
    const [row] = await db.select().from(s.tags).where(eq(s.tags.id, id));
    return row ?? null;
  }

  async create(data: { name: string; color?: string }): Promise<TagRow> {
    const [row] = await db
      .insert(s.tags)
      .values({ name: data.name.trim(), color: data.color ?? '#1677ff' })
      .returning();
    return row;
  }

  async update(id: number, data: { name?: string; color?: string }): Promise<void> {
    await db
      .update(s.tags)
      .set({
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
      })
      .where(eq(s.tags.id, id));
  }

  async delete(id: number): Promise<void> {
    await db.delete(s.tags).where(eq(s.tags.id, id));
  }

  // Get tags for a specific entity
  async getEntityTags(entityType: EntityTagType, entityId: number): Promise<TagRow[]> {
    const rows = await db
      .select({ tag: s.tags })
      .from(s.entityTags)
      .innerJoin(s.tags, eq(s.entityTags.tagId, s.tags.id))
      .where(and(eq(s.entityTags.entityType, entityType), eq(s.entityTags.entityId, entityId)));
    return rows.map((r) => r.tag);
  }

  // Replace all tags for an entity (PUT semantics)
  async setEntityTags(
    entityType: EntityTagType,
    entityId: number,
    tagIds: number[],
  ): Promise<void> {
    await db
      .delete(s.entityTags)
      .where(and(eq(s.entityTags.entityType, entityType), eq(s.entityTags.entityId, entityId)));
    if (tagIds.length > 0) {
      await db
        .insert(s.entityTags)
        .values(tagIds.map((tagId) => ({ tagId, entityType, entityId })));
    }
  }

  // Get all entity IDs that have a given tag, grouped by type
  async getEntitiesByTag(tagId: number): Promise<Record<EntityTagType, number[]>> {
    const rows = await db.select().from(s.entityTags).where(eq(s.entityTags.tagId, tagId));

    const result: Record<string, number[]> = {};
    for (const r of rows) {
      if (!result[r.entityType]) result[r.entityType] = [];
      result[r.entityType].push(r.entityId);
    }
    return result as Record<EntityTagType, number[]>;
  }

  // Get tag IDs mapped to entity (for bulk loading)
  async getTagsForEntities(
    entityType: EntityTagType,
    entityIds: number[],
  ): Promise<Map<number, TagRow[]>> {
    if (entityIds.length === 0) return new Map();
    const rows = await db
      .select({ entityId: s.entityTags.entityId, tag: s.tags })
      .from(s.entityTags)
      .innerJoin(s.tags, eq(s.entityTags.tagId, s.tags.id))
      .where(
        and(eq(s.entityTags.entityType, entityType), inArray(s.entityTags.entityId, entityIds)),
      );
    const map = new Map<number, TagRow[]>();
    for (const r of rows) {
      if (!map.has(r.entityId)) map.set(r.entityId, []);
      map.get(r.entityId)!.push(r.tag);
    }
    return map;
  }
}
