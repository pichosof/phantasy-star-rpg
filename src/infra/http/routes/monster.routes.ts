import type { FastifyInstance } from 'fastify';

import { MonsterController } from '../controllers/monster.controller.js';

export async function monsterRoutes(app: FastifyInstance) {
  const c = new MonsterController();
  app.get('/api/bestiary', c.list.bind(c));
  app.post('/api/bestiary', c.create.bind(c));
  app.patch('/api/bestiary/:id/discovered', c.setDiscovered.bind(c));
  app.patch('/api/bestiary/:id/image', c.updateImage.bind(c));
  app.delete('/api/bestiary/:id', c.delete.bind(c));
}
