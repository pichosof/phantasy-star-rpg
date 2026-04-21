import type { FastifyInstance } from 'fastify';

import { DungeonController } from '../controllers/dungeon.controller.js';

const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } };
const nullableString = { type: 'string', nullable: true };
const nullableNumber = { type: 'number', nullable: true };

export async function dungeonRoutes(app: FastifyInstance) {
  const c = new DungeonController();

  app.get(
    '/api/dungeons',
    { schema: { tags: ['Dungeons'], response: { 200: { type: 'array' } } } },
    c.list.bind(c),
  );

  app.post(
    '/api/dungeons',
    app.withGM({
      schema: {
        tags: ['Dungeons'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            type: nullableString,
            description: nullableString,
            region: nullableString,
            coordinates: nullableString,
            cityId: nullableNumber,
            worldId: nullableNumber,
          },
          additionalProperties: false,
        },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    }),
    c.create.bind(c),
  );

  app.patch(
    '/api/dungeons/:id',
    app.withGM({
      schema: {
        tags: ['Dungeons'],
        security: [{ ApiKeyAuth: [] }],
        params: idParam,
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: nullableString,
            description: nullableString,
            region: nullableString,
            coordinates: nullableString,
            discovered: { type: 'boolean' },
            cityId: nullableNumber,
            worldId: nullableNumber,
          },
          additionalProperties: false,
        },
        response: { 204: { description: 'No Content' } },
      },
    }),
    c.update.bind(c),
  );

  app.patch(
    '/api/dungeons/:id/visibility',
    app.withGM({
      schema: {
        tags: ['Dungeons'],
        security: [{ ApiKeyAuth: [] }],
        params: idParam,
        body: {
          type: 'object',
          required: ['visible'],
          properties: { visible: { type: 'boolean' } },
        },
        response: { 204: { description: 'No Content' } },
      },
    }),
    c.setVisibility.bind(c),
  );

  app.patch(
    '/api/dungeons/:id/discovered',
    app.withGM({
      schema: {
        tags: ['Dungeons'],
        security: [{ ApiKeyAuth: [] }],
        params: idParam,
        body: {
          type: 'object',
          required: ['discovered'],
          properties: { discovered: { type: 'boolean' } },
        },
        response: { 204: { description: 'No Content' } },
      },
    }),
    c.setDiscovered.bind(c),
  );

  app.delete(
    '/api/dungeons/:id',
    app.withGM({
      schema: {
        tags: ['Dungeons'],
        security: [{ ApiKeyAuth: [] }],
        params: idParam,
        response: { 204: { description: 'No Content' } },
      },
    }),
    c.delete.bind(c),
  );

  app.post(
    '/api/dungeons/:id/images',
    app.withGM({
      schema: {
        tags: ['Dungeons'],
        security: [{ ApiKeyAuth: [] }],
        params: idParam,
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    }),
    c.addImage.bind(c),
  );

  app.delete(
    '/api/dungeons/:id/images/:imageId',
    app.withGM({
      schema: {
        tags: ['Dungeons'],
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'imageId'],
          properties: { id: { type: 'string' }, imageId: { type: 'string' } },
        },
        response: { 204: { description: 'No Content' } },
      },
    }),
    c.deleteImage.bind(c),
  );
}
