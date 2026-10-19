import type { FastifyInstance, FastifyReply } from 'fastify';

import { container } from '../../../di/container.js';

type IdRoute = { Params: { id: string } };

const idOf = (raw: string, reply: FastifyReply) => {
  const id = Number(raw);
  if (Number.isInteger(id) && id > 0) return id;
  void reply.code(400).send({ error: 'Invalid id' });
  return null;
};

/**
 * Item catalogue. Players: published public items with player fields only (explicit
 * whitelist, so new GM fields never leak). GM: everything, CRUD and bulk import (seed).
 */
export async function itemsRoutes(app: FastifyInstance) {
  const gm = { schema: { tags: ['GM'], security: [{ ApiKeyAuth: [] }] } };

  app.get('/api/items', { schema: { tags: ['Items'] } }, async () =>
    container.resolve('listItems').execute(false),
  );

  app.get<IdRoute>('/api/items/:id', { schema: { tags: ['Items'] } }, async (req, reply) => {
    const id = idOf(req.params.id, reply);
    return id === null ? reply : container.resolve('getItem').execute(id, false);
  });

  app.get('/api/gm/items', app.withGM(gm), async () =>
    container.resolve('listItems').execute(true),
  );

  app.get<IdRoute>('/api/gm/items/:id', app.withGM(gm), async (req, reply) => {
    const id = idOf(req.params.id, reply);
    return id === null ? reply : container.resolve('getItem').execute(id, true);
  });

  app.post('/api/gm/items', app.withGM(gm), async (req, reply) =>
    reply.code(201).send(await container.resolve('createItem').execute(req.body)),
  );

  app.patch<IdRoute>('/api/gm/items/:id', app.withGM(gm), async (req, reply) => {
    const id = idOf(req.params.id, reply);
    return id === null ? reply : container.resolve('updateItem').execute(id, req.body);
  });

  app.delete<IdRoute>('/api/gm/items/:id', app.withGM(gm), async (req, reply) => {
    const id = idOf(req.params.id, reply);
    if (id === null) return reply;
    await container.resolve('deleteItem').execute(id);
    return reply.code(204).send();
  });

  // Seeding: upsert by code, up to 200 per request (scripts/items/push-seed.ts batches).
  app.post('/api/gm/items/import', app.withGM(gm), async (req) =>
    container.resolve('importItems').execute(req.body),
  );
}
