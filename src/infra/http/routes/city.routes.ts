import type { FastifyInstance } from 'fastify';

import { CityController } from '../controllers/city.controller';

type IdParams = { id: string };
type VisibilityBody = { visible: boolean };

export async function cityRoutes(app: FastifyInstance) {
  const c = new CityController();

  // GET público
  app.get(
    '/api/cities',
    {
      schema: {
        tags: ['Cities'],
        response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
      },
    },
    c.list.bind(c),
  );

  app.patch<{ Params: IdParams; Body: VisibilityBody }>(
    '/api/cities/:id/visibility',
    app.withGM({
      schema: {
        tags: ['Cities'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['visible'],
          properties: { visible: { type: 'boolean' } },
          additionalProperties: false,
        },
        response: { 204: { type: 'null' } },
      },
    }),
    c.setVisibility.bind(c),
  );
  // POST protegido
  app.post(
    '/api/cities',
    app.withGM({
      schema: {
        tags: ['Cities'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            description: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            discovered: { type: 'boolean', default: false },
            coordinates: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            imageUrl: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            imageAlt: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            worldId: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          },
          additionalProperties: false,
        },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    }),
    c.create.bind(c),
  );

  // PATCH discovered protegido (já tinha)
  app.patch(
    '/api/cities/:id/discovered',
    app.withGM({
      schema: {
        tags: ['Cities'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['discovered'],
          properties: { discovered: { type: 'boolean' } },
          additionalProperties: false,
        },
        response: { 204: { type: 'null' } },
      },
    }),
    c.setDiscovered.bind(c),
  );

  // 👇 NOVO: PATCH update protegido
  app.patch(
    '/api/cities/:id',
    app.withGM({
      schema: {
        tags: ['Cities'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            discovered: { type: 'boolean' },
            coordinates: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            imageUrl: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            imageAlt: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            worldId: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          },
          additionalProperties: false,
        },
        response: { 204: { type: 'null' } },
      },
    }),
    c.update.bind(c),
  );

  // DELETE protegido
  app.delete(
    '/api/cities/:id',
    app.withGM({
      schema: {
        tags: ['Cities'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 204: { type: 'null' } },
      },
    }),
    c.delete.bind(c),
  );
}
