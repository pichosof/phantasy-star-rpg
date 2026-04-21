import type { FastifyInstance } from 'fastify';

import { CharacterSheetsController } from '../controllers/character-sheets.controller.js';

export async function characterSheetsRoutes(app: FastifyInstance) {
  const ctrl = new CharacterSheetsController();

  app.get('/api/gm/sheets', app.withGM({ schema: { tags: ['GM'] } }), ctrl.list.bind(ctrl));
  app.get('/api/gm/sheets/:id', app.withGM({ schema: { tags: ['GM'] } }), ctrl.get.bind(ctrl));
  app.post(
    '/api/gm/sheets',
    app.withGM({ schema: { tags: ['GM'], security: [{ ApiKeyAuth: [] }] } }),
    ctrl.create.bind(ctrl),
  );
  app.patch(
    '/api/gm/sheets/:id',
    app.withGM({ schema: { tags: ['GM'], security: [{ ApiKeyAuth: [] }] } }),
    ctrl.update.bind(ctrl),
  );
  app.delete(
    '/api/gm/sheets/:id',
    app.withGM({ schema: { tags: ['GM'], security: [{ ApiKeyAuth: [] }] } }),
    ctrl.delete.bind(ctrl),
  );
}
