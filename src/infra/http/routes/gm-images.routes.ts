import type { FastifyInstance } from 'fastify';

import { GmImagesController } from '../controllers/gm-images.controller.js';

export async function gmImagesRoutes(app: FastifyInstance) {
  const ctrl = new GmImagesController();

  app.get('/api/gm/images', app.withGM({ schema: { tags: ['GM'] } }), ctrl.list.bind(ctrl));
  app.post(
    '/api/gm/images',
    app.withGM({
      schema: { tags: ['GM'], security: [{ ApiKeyAuth: [] }], consumes: ['multipart/form-data'] },
    }),
    ctrl.upload.bind(ctrl),
  );
  app.delete(
    '/api/gm/images/:id',
    app.withGM({ schema: { tags: ['GM'], security: [{ ApiKeyAuth: [] }] } }),
    ctrl.delete.bind(ctrl),
  );
}
