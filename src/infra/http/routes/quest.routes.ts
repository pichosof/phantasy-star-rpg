import type { FastifyInstance } from 'fastify';

import { QuestController } from '../controllers/quest.controller.js';

export async function questRoutes(app: FastifyInstance) {
  const ctrl = new QuestController();

  app.get(
    '/api/quests',
    app.withGM({
      schema: {
        tags: ['Quests'],
        security: [{ ApiKeyAuth: [] }],
        response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
      },
    }),
    ctrl.list.bind(ctrl),
  );

  app.post(
    '/api/quests',
    app.withGM({
      schema: {
        tags: ['Quests'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            reward: { type: 'string', nullable: true },
          },
          additionalProperties: false,
        },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    }),
    ctrl.create.bind(ctrl),
  );

  app.post(
    '/api/quests/:id/complete',
    app.withGM({
      schema: {
        tags: ['Quests'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 204: { description: 'No Content' } },
      },
    }),
    ctrl.complete.bind(ctrl),
  );

  app.patch(
    '/api/quests/:id',
    app.withGM({
      schema: {
        tags: ['Quests'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            reward: { type: 'string', nullable: true },
            status: { enum: ['active', 'completed', 'failed'] },
          },
          additionalProperties: false,
        },
        response: { 204: { description: 'No Content' } },
      },
    }),
    ctrl.update.bind(ctrl),
  );
}
