import type { FastifyInstance } from 'fastify';

import { CityLinksController } from '../controllers/city-links.controller';
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

  // PATCH imagem protegido
  app.patch(
    '/api/cities/:id/image',
    app.withGM({
      schema: {
        tags: ['Cities'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 204: { type: 'null' } },
      },
    }),
    c.updateImage.bind(c),
  );

  // POST imagem (adicionar uma das N imagens)
  app.post(
    '/api/cities/:id/images',
    app.withGM({
      schema: {
        tags: ['Cities'],
        security: [{ BearerAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    }),
    c.addImage.bind(c),
  );

  // DELETE imagem individual
  app.delete(
    '/api/cities/:id/images/:imageId',
    app.withGM({
      schema: {
        tags: ['Cities'],
        security: [{ BearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'imageId'],
          properties: { id: { type: 'string' }, imageId: { type: 'string' } },
        },
        response: { 204: { type: 'null' } },
      },
    }),
    c.deleteImage.bind(c),
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

  const linksController = new CityLinksController();

  app.get(
    '/api/cities/:id/lores',
    {
      schema: {
        tags: ['Cities'],
        response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
      },
    },
    linksController.listLoresByCityId,
  );
  app.get(
    '/api/cities/:id/quests',
    {
      schema: {
        tags: ['Cities'],
        response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
      },
    },
    linksController.listQuestsByCityId,
  );
  app.get(
    '/api/gm/cities/:id/quests',
    app.withGM({
      schema: {
        tags: ['Cities', 'GM'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
      },
    }),
    linksController.listQuestsByCityId,
  );

  app.get(
    '/api/gm/cities/:id/lores',
    app.withGM({
      schema: {
        tags: ['Cities', 'GM'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
      },
    }),
    linksController.listLoresByCityId,
  );
}
