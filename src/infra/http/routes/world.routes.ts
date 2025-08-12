import type { FastifyInstance } from 'fastify';

import { WorldController } from '../controllers/world.controller';

export async function worldRoutes(app: FastifyInstance) {
  const c = new WorldController();

  app.get(
    '/api/worlds',
    {
      schema: {
        tags: ['Worlds'],
        response: {
          200: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
    },
    c.list.bind(c),
  );

  app.post(
    '/api/worlds',
    app.withGM({
      schema: {
        tags: ['Worlds'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            description: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
          additionalProperties: false,
        },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    }),
    c.create.bind(c),
  );

  app.patch(
    '/api/worlds/:id/image',
    app.withGM({
      schema: {
        tags: ['Worlds'],
        security: [{ ApiKeyAuth: [] }],
        consumes: ['multipart/form-data'],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 204: { type: 'null' } },
      },
    }),
    c.updateImage.bind(c),
  );

  app.patch(
    '/api/worlds/:id',
    app.withGM({
      schema: {
        tags: ['Worlds'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
          additionalProperties: false,
        },
        response: { 204: { type: 'null' } },
      },
    }),
    c.update.bind(c),
  );
}
