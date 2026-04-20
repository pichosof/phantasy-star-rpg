import type { FastifyInstance } from 'fastify';

import { PlayerNotesController } from '../controllers/player-notes.controller.js';

export async function playerNotesRoutes(app: FastifyInstance) {
  const ctrl = new PlayerNotesController();

  // GET público — qualquer um pode ver as notas de um player
  app.get(
    '/api/players/:id/notes',
    {
      schema: {
        tags: ['Players'],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
      },
    },
    ctrl.list.bind(ctrl),
  );

  // POST — GM cria nota
  app.post(
    '/api/players/:id/notes',
    app.withGM({
      schema: {
        tags: ['Players'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['title', 'date'],
          properties: {
            title: { type: 'string' },
            content: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            date: { type: 'string' },
          },
          additionalProperties: false,
        },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    }),
    ctrl.create.bind(ctrl),
  );

  // PATCH — GM edita nota
  app.patch(
    '/api/players/:id/notes/:noteId',
    app.withGM({
      schema: {
        tags: ['Players'],
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'noteId'],
          properties: { id: { type: 'string' }, noteId: { type: 'string' } },
        },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            content: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            date: { type: 'string' },
          },
          additionalProperties: false,
        },
        response: { 204: { type: 'null' } },
      },
    }),
    ctrl.update.bind(ctrl),
  );

  // DELETE — GM remove nota
  app.delete(
    '/api/players/:id/notes/:noteId',
    app.withGM({
      schema: {
        tags: ['Players'],
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'noteId'],
          properties: { id: { type: 'string' }, noteId: { type: 'string' } },
        },
        response: { 204: { type: 'null' } },
      },
    }),
    ctrl.delete.bind(ctrl),
  );
}
