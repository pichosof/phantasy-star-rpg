import type { FastifyInstance } from 'fastify';

import { QuestCityController } from '../controllers/quest-city.controller';

export async function questCityRoutes(app: FastifyInstance) {
  const ctrl = new QuestCityController();

  app.get(
    '/api/quests/:questId/cities',
    {
      schema: {
        tags: ['Quests', 'Cities'],
        params: {
          type: 'object',
          required: ['questId'],
          properties: { questId: { type: 'string' } },
        },
        response: { 200: { type: 'array' } },
      },
    },
    ctrl.listCities.bind(ctrl),
  );

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
        response: { 204: { description: 'No Content' } },
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
        response: { 204: { description: 'No Content' } },
      },
    }),
    ctrl.unlink.bind(ctrl),
  );
}
