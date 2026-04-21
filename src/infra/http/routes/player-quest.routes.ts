import type { FastifyInstance } from 'fastify';

import { PlayerQuestController } from '../controllers/player-quest.controller';

export async function playerQuestRoutes(app: FastifyInstance) {
  const c = new PlayerQuestController();

  app.post(
    '/api/players/:playerId/quests/:questId',
    app.withGM({
      schema: {
        tags: ['Players', 'Quests'],
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          required: ['playerId', 'questId'],
          properties: { playerId: { type: 'string' }, questId: { type: 'string' } },
        },
        response: { 204: { description: 'No Content' } },
      },
    }),
    c.assign.bind(c),
  );

  app.patch(
    '/api/players/:playerId/quests/:questId/status',
    app.withGM({
      schema: {
        tags: ['Players', 'Quests'],
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          required: ['playerId', 'questId'],
          properties: { playerId: { type: 'string' }, questId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: { status: { enum: ['assigned', 'completed', 'failed'] } },
          additionalProperties: false,
        },
        response: { 204: { description: 'No Content' } },
      },
    }),
    c.setStatus.bind(c),
  );

  app.patch(
    '/api/players/:id',
    app.withGM({
      schema: {
        tags: ['Players'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            level: { type: 'number' },
            background: { type: 'string', nullable: true },
          },
          additionalProperties: false,
        },
        response: { 204: { description: 'No Content' } },
      },
    }),
    c.update.bind(c),
  );
}
