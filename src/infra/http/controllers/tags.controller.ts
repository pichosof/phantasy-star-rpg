import type { FastifyReply, FastifyRequest } from 'fastify';

import { container } from '../../../di/container.js';
import * as s from '../../db/schema.js';

type EntityTagType = (typeof s.entityTagTypes)[number];
type IdParams = { id: string };
type EntityParams = { type: string; entityId: string };

function isValidEntityType(t: string): t is EntityTagType {
  return (s.entityTagTypes as readonly string[]).includes(t);
}

export class TagsController {
  async list(_req: FastifyRequest, reply: FastifyReply) {
    const repo = container.resolve('tagsRepo');
    const tags = await repo.listAll();
    return reply.send(tags);
  }

  async create(
    req: FastifyRequest<{ Body: { name: string; color?: string } }>,
    reply: FastifyReply,
  ) {
    const { name, color } = req.body;
    if (!name?.trim()) return reply.code(400).send({ error: 'name required' });
    const repo = container.resolve('tagsRepo');
    const tag = await repo.create({ name, color });
    return reply.code(201).send(tag);
  }

  async update(
    req: FastifyRequest<{ Params: IdParams; Body: { name?: string; color?: string } }>,
    reply: FastifyReply,
  ) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    const repo = container.resolve('tagsRepo');
    await repo.update(id, req.body);
    return reply.code(204).send();
  }

  async delete(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    const repo = container.resolve('tagsRepo');
    await repo.delete(id);
    return reply.code(204).send();
  }

  // GET /api/tags/:id/entities — all entities grouped by type
  async getEntities(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const tagId = Number(req.params.id);
    if (!Number.isFinite(tagId)) return reply.code(400).send({ error: 'Invalid id' });

    const tagsRepo = container.resolve('tagsRepo');
    const tag = await tagsRepo.findById(tagId);
    if (!tag) return reply.code(404).send({ error: 'Tag not found' });

    const entityMap = await tagsRepo.getEntitiesByTag(tagId);

    // Fetch actual entity data for each type
    const db = (await import('../../db/index.js')).db;
    const sc = await import('../../db/schema.js');
    const { inArray } = await import('drizzle-orm');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function fetchByIds<T>(table: any, ids: number[], idCol: any): Promise<T[]> {
      if (!ids || ids.length === 0) return [];
      return db.select().from(table).where(inArray(idCol, ids)) as Promise<T[]>;
    }

    const [beasts, npcs, cities, dungeons, worlds, players, lores, quests] = await Promise.all([
      fetchByIds(sc.bestiary, entityMap['beast'] ?? [], sc.bestiary.id),
      fetchByIds(sc.npcs, entityMap['npc'] ?? [], sc.npcs.id),
      fetchByIds(sc.cities, entityMap['city'] ?? [], sc.cities.id),
      fetchByIds(sc.dungeons, entityMap['dungeon'] ?? [], sc.dungeons.id),
      fetchByIds(sc.worlds, entityMap['world'] ?? [], sc.worlds.id),
      fetchByIds(sc.players, entityMap['player'] ?? [], sc.players.id),
      fetchByIds(sc.lores, entityMap['lore'] ?? [], sc.lores.id),
      fetchByIds(sc.quests, entityMap['quest'] ?? [], sc.quests.id),
    ]);

    return reply.send({ tag, beasts, npcs, cities, dungeons, worlds, players, lores, quests });
  }

  // GET /api/entity-tags/:type/:entityId
  async getEntityTags(req: FastifyRequest<{ Params: EntityParams }>, reply: FastifyReply) {
    const { type } = req.params;
    const entityId = Number(req.params.entityId);
    if (!isValidEntityType(type)) return reply.code(400).send({ error: 'Invalid entity type' });
    if (!Number.isFinite(entityId)) return reply.code(400).send({ error: 'Invalid entityId' });
    const repo = container.resolve('tagsRepo');
    const tags = await repo.getEntityTags(type, entityId);
    return reply.send(tags);
  }

  // PUT /api/entity-tags/:type/:entityId  { tagIds: number[] }
  async setEntityTags(
    req: FastifyRequest<{ Params: EntityParams; Body: { tagIds: number[] } }>,
    reply: FastifyReply,
  ) {
    const { type } = req.params;
    const entityId = Number(req.params.entityId);
    if (!isValidEntityType(type)) return reply.code(400).send({ error: 'Invalid entity type' });
    if (!Number.isFinite(entityId)) return reply.code(400).send({ error: 'Invalid entityId' });
    const tagIds = req.body?.tagIds ?? [];
    if (!Array.isArray(tagIds)) return reply.code(400).send({ error: 'tagIds must be array' });
    const repo = container.resolve('tagsRepo');
    await repo.setEntityTags(type, entityId, tagIds);
    return reply.code(204).send();
  }
}
