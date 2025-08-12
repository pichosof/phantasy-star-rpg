import type { FastifyInstance } from 'fastify';

import { UploadController } from '../controllers/upload.controller.js';

export async function uploadRoutes(app: FastifyInstance) {
  const ctrl = new UploadController();

  // Upload protegido (só GM)
  app.post(
    '/api/uploads/image',
    app.withGM({
      schema: {
        tags: ['Uploads'],
        security: [{ ApiKeyAuth: [] }],
        // se for multipart, não documenta body detalhado aqui (o Swagger UI já dá a noção)
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    }),
    ctrl.uploadImage.bind(ctrl),
  );
}
