import type { FastifyInstance } from 'fastify';

import { LoreController } from '../controllers/lore.controller.js';

export async function loreRoutes(app: FastifyInstance) {
  const c = new LoreController();
  app.get('/api/lores', c.list.bind(c));
  app.post('/api/lores', c.create.bind(c));
  app.delete('/api/lores/:id', c.delete.bind(c));
}
