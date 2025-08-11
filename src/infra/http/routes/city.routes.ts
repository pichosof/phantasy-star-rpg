import type { FastifyInstance } from 'fastify';

import { CityController } from '../controllers/city.controller.js';

export async function cityRoutes(app: FastifyInstance) {
  const c = new CityController();
  app.get('/api/cities', c.list.bind(c));
  app.post('/api/cities', c.create.bind(c));
  app.patch('/api/cities/:id/discovered', c.setDiscovered.bind(c));
  app.delete('/api/cities/:id', c.delete.bind(c));
}
