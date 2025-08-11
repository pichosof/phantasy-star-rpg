import type { FastifyInstance } from 'fastify';

import { MapMarkerController } from '../controllers/map-marker.controller.js';

export async function mapMarkerRoutes(app: FastifyInstance) {
  const c = new MapMarkerController();
  app.get('/api/map-markers', c.list.bind(c));
  app.post('/api/map-markers', c.create.bind(c));
  app.patch('/api/map-markers/:id/discovered', c.setDiscovered.bind(c));
  app.delete('/api/map-markers/:id', c.delete.bind(c));
}
