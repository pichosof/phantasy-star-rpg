import type { FastifyInstance } from 'fastify';

import { SessionController } from '../controllers/session.controller.js';

export async function sessionRoutes(app: FastifyInstance) {
  const c = new SessionController();
  app.get('/api/sessions', c.list.bind(c));
  app.post('/api/sessions', c.create.bind(c));
  app.delete('/api/sessions/:id', c.delete.bind(c));
}
