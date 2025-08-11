import type { FastifyInstance } from 'fastify';

import { TimelineController } from '../controllers/timeline.controller.js';

export async function timelineRoutes(app: FastifyInstance) {
  const c = new TimelineController();
  app.get('/api/timeline', c.list.bind(c));
  app.post('/api/timeline', c.create.bind(c));
  app.delete('/api/timeline/:id', c.delete.bind(c));
}
