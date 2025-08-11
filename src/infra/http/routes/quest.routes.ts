import type { FastifyInstance } from 'fastify';

import { QuestController } from '../controllers/quest.controller.js';

export async function questRoutes(app: FastifyInstance) {
  const ctrl = new QuestController();
  app.get('/api/quests', ctrl.list.bind(ctrl));
  app.post('/api/quests', ctrl.create.bind(ctrl));
  app.post('/api/quests/:id/complete', ctrl.complete.bind(ctrl));
}
