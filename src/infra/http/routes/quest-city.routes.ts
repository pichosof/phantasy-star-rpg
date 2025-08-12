import type { FastifyInstance } from 'fastify';

import { QuestCityController } from '../controllers/quest-city.controller';

export async function questCityRoutes(app: FastifyInstance) {
  const ctrl = new QuestCityController();

  app.post(
    '/api/quests/:questId/cities/:cityId',
    app.withGM({
      schema: {
        tags: ['Quests', 'Cities'],
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          required: ['questId', 'cityId'],
          properties: { questId: { type: 'string' }, cityId: { type: 'string' } },
        },
        response: { 204: { type: 'null' } },
      },
    }),
    ctrl.link.bind(ctrl),
  );

  app.delete(
    '/api/quests/:questId/cities/:cityId',
    app.withGM({
      schema: {
        tags: ['Quests', 'Cities'],
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          required: ['questId', 'cityId'],
          properties: { questId: { type: 'string' }, cityId: { type: 'string' } },
        },
        response: { 204: { type: 'null' } },
      },
    }),
    ctrl.unlink.bind(ctrl),
  );
}
