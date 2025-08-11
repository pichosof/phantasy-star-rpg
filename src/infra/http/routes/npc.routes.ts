import type { FastifyInstance } from 'fastify';

import { NpcController } from '../controllers/npc.controller.js';

export async function npcRoutes(app: FastifyInstance) {
  const ctrl = new NpcController();
  app.get('/api/npcs', ctrl.list.bind(ctrl));
  app.post('/api/npcs', ctrl.create.bind(ctrl));
  app.delete('/api/npcs/:id', ctrl.delete.bind(ctrl));
  app.patch('/api/npcs/:id/image', ctrl.updateImage.bind(ctrl)); // novo
}
