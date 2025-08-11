import type { FastifyInstance } from 'fastify';

import { UploadController } from '../controllers/upload.controller.js';

export async function uploadRoutes(app: FastifyInstance) {
  const ctrl = new UploadController();
  app.post('/api/uploads/image', ctrl.uploadImage.bind(ctrl));
}
