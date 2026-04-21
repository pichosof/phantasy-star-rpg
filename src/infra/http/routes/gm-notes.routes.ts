import type { FastifyInstance } from 'fastify';

import { GmNotesController } from '../controllers/gm-notes.controller.js';

export async function gmNotesRoutes(app: FastifyInstance) {
  const ctrl = new GmNotesController();

  app.get('/api/gm/notes', app.withGM({ schema: { tags: ['GM'] } }), ctrl.list.bind(ctrl));
  app.post(
    '/api/gm/notes',
    app.withGM({ schema: { tags: ['GM'], security: [{ ApiKeyAuth: [] }] } }),
    ctrl.create.bind(ctrl),
  );
  app.patch(
    '/api/gm/notes/:id',
    app.withGM({ schema: { tags: ['GM'], security: [{ ApiKeyAuth: [] }] } }),
    ctrl.update.bind(ctrl),
  );
  app.delete(
    '/api/gm/notes/:id',
    app.withGM({ schema: { tags: ['GM'], security: [{ ApiKeyAuth: [] }] } }),
    ctrl.delete.bind(ctrl),
  );
}
