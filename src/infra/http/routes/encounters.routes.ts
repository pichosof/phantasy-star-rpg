import type { FastifyInstance } from 'fastify';

import { EncountersController } from '../controllers/encounters.controller.js';

/** Combat tracker (GM only). */
export async function encountersRoutes(app: FastifyInstance) {
  const ctrl = new EncountersController();
  const gm = { schema: { tags: ['GM'], security: [{ ApiKeyAuth: [] }] } };

  app.get('/api/gm/encounters', app.withGM(gm), ctrl.list.bind(ctrl));
  app.get('/api/gm/encounters/:id', app.withGM(gm), ctrl.get.bind(ctrl));
  app.post('/api/gm/encounters', app.withGM(gm), ctrl.create.bind(ctrl));
  app.put('/api/gm/encounters/:id', app.withGM(gm), ctrl.save.bind(ctrl));
  app.delete('/api/gm/encounters/:id', app.withGM(gm), ctrl.delete.bind(ctrl));
}
