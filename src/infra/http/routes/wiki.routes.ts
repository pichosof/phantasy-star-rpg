import type { FastifyInstance } from 'fastify';

import { WikiController } from '../controllers/wiki.controller.js';

type IdParams = { id: string };

export async function wikiRoutes(app: FastifyInstance) {
  const c = new WikiController();

  // GET público — jogadores consultam sem autenticação
  app.get(
    '/api/wiki',
    {
      schema: {
        tags: ['Wiki'],
        response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
      },
    },
    c.list.bind(c),
  );

  // POST — criar página (GM)
  app.post(
    '/api/wiki',
    app.withGM({
      schema: {
        tags: ['Wiki'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string' },
            category: { type: 'string', nullable: true },
            content: { type: 'string', nullable: true },
            pinned: { type: 'boolean' },
            visible: { type: 'boolean' },
          },
          additionalProperties: false,
        },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    }),
    c.create.bind(c),
  );

  // PATCH update (GM)
  app.patch<{ Params: IdParams }>(
    '/api/wiki/:id',
    app.withGM({
      schema: {
        tags: ['Wiki'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            category: { type: 'string', nullable: true },
            content: { type: 'string', nullable: true },
            pinned: { type: 'boolean' },
            visible: { type: 'boolean' },
          },
          additionalProperties: false,
        },
        response: { 204: { description: 'No Content' } },
      },
    }),
    c.update.bind(c),
  );

  // PATCH visibility (GM)
  app.patch<{ Params: IdParams; Body: { visible: boolean } }>(
    '/api/wiki/:id/visibility',
    app.withGM({
      schema: {
        tags: ['Wiki'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['visible'],
          properties: { visible: { type: 'boolean' } },
          additionalProperties: false,
        },
        response: { 204: { description: 'No Content' } },
      },
    }),
    c.setVisibility.bind(c),
  );

  // POST upload imagem inline (GM)
  app.post(
    '/api/wiki/upload',
    app.withGM({
      schema: {
        tags: ['Wiki'],
        security: [{ ApiKeyAuth: [] }],
        response: { 200: { type: 'object', properties: { url: { type: 'string' } } } },
      },
    }),
    c.uploadImage.bind(c),
  );

  // DELETE (GM)
  app.delete<{ Params: IdParams }>(
    '/api/wiki/:id',
    app.withGM({
      schema: {
        tags: ['Wiki'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 204: { description: 'No Content' } },
      },
    }),
    c.delete.bind(c),
  );
}
