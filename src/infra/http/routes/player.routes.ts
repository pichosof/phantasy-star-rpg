import type { FastifyInstance } from 'fastify';

import { PlayerController } from '../controllers/player.controller';

export async function playerRoutes(app: FastifyInstance) {
  const ctrl = new PlayerController();

  app.get(
    '/api/players',
    {
      schema: {
        tags: ['Players'],
        // resposta genérica (evita 500 no /docs)
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: true, // <- genérico, sem travar
            },
          },
        },
      },
    },
    ctrl.list.bind(ctrl),
  );

  app.post(
    '/api/players',
    app.withGM({
      schema: {
        tags: ['Players'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            level: { type: 'number', default: 1 },
            background: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
          additionalProperties: false,
        },
        response: {
          201: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    }),
    ctrl.create.bind(ctrl),
  );

  // PATCH imagem do player
  app.patch(
    '/api/players/:id/image',
    app.withGM({
      schema: {
        tags: ['Players'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 204: { type: 'null' } },
      },
    }),
    ctrl.updateImage.bind(ctrl),
  );

  // PATCH ficha (PDF) do player
  app.patch(
    '/api/players/:id/sheet',
    app.withGM({
      schema: {
        tags: ['Players'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 204: { type: 'null' } },
      },
    }),
    ctrl.updateSheet.bind(ctrl),
  );
}
