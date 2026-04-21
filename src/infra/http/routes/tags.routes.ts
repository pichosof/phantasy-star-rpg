import type { FastifyInstance } from 'fastify';

import { TagsController } from '../controllers/tags.controller.js';

const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } };

export async function tagsRoutes(app: FastifyInstance) {
  const c = new TagsController();

  app.get(
    '/api/tags',
    { schema: { tags: ['Tags'], response: { 200: { type: 'array' } } } },
    c.list.bind(c),
  );

  app.post(
    '/api/tags',
    app.withGM({
      schema: {
        tags: ['Tags'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            color: { type: 'string' },
          },
          additionalProperties: false,
        },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    }),
    c.create.bind(c),
  );

  app.patch(
    '/api/tags/:id',
    app.withGM({
      schema: {
        tags: ['Tags'],
        security: [{ ApiKeyAuth: [] }],
        params: idParam,
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            color: { type: 'string' },
          },
          additionalProperties: false,
        },
        response: { 204: { description: 'No Content' } },
      },
    }),
    c.update.bind(c),
  );

  app.delete(
    '/api/tags/:id',
    app.withGM({
      schema: {
        tags: ['Tags'],
        security: [{ ApiKeyAuth: [] }],
        params: idParam,
        response: { 204: { description: 'No Content' } },
      },
    }),
    c.delete.bind(c),
  );

  app.get(
    '/api/tags/:id/entities',
    {
      schema: {
        tags: ['Tags'],
        params: idParam,
        response: { 200: { type: 'object', additionalProperties: true } },
      },
    },
    c.getEntities.bind(c),
  );

  app.get(
    '/api/entity-tags/:type/:entityId',
    {
      schema: {
        tags: ['Tags'],
        params: {
          type: 'object',
          required: ['type', 'entityId'],
          properties: { type: { type: 'string' }, entityId: { type: 'string' } },
        },
        response: { 200: { type: 'array' } },
      },
    },
    c.getEntityTags.bind(c),
  );

  app.put(
    '/api/entity-tags/:type/:entityId',
    app.withGM({
      schema: {
        tags: ['Tags'],
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          required: ['type', 'entityId'],
          properties: { type: { type: 'string' }, entityId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['tagIds'],
          properties: { tagIds: { type: 'array', items: { type: 'number' } } },
          additionalProperties: false,
        },
        response: { 204: { description: 'No Content' } },
      },
    }),
    c.setEntityTags.bind(c),
  );
}
