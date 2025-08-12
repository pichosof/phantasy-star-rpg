import type { FastifyInstance } from 'fastify';

import { LoreController } from '../controllers/lore.controller';

export async function loreRoutes(app: FastifyInstance) {
  const c = new LoreController();

  // GET público
  app.get(
    '/api/lores',
    {
      schema: {
        tags: ['Lore'],
        response: {
          200: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
    },
    c.list.bind(c),
  );

  // POST protegido (GM)
  app.post(
    '/api/lores',
    app.withGM({
      schema: {
        tags: ['Lore'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string' },
            category: { enum: ['history', 'culture', 'tech', 'biology', 'myth', null] },
            content: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
          additionalProperties: false,
        },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    }),
    c.create.bind(c),
  );

  // PATCH protegido (GM)
  app.patch(
    '/api/lores/:id',
    app.withGM({
      schema: {
        tags: ['Lore'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            category: { enum: ['history', 'culture', 'tech', 'biology', 'myth', null] },
            content: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
          additionalProperties: false,
        },
        response: { 204: { type: 'null' } },
      },
    }),
    c.update.bind(c),
  );

  // DELETE protegido (GM)
  app.delete(
    '/api/lores/:id',
    app.withGM({
      schema: {
        tags: ['Lore'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 204: { type: 'null' } },
      },
    }),
    c.delete.bind(c),
  );
}
