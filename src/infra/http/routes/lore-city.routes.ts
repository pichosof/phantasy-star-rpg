import type { FastifyInstance } from 'fastify';

import { LoreCityController } from '../controllers/lore-city.controller';

export async function loreCityRoutes(app: FastifyInstance) {
  const ctrl = new LoreCityController();

  app.post(
    '/api/lores/:loreId/cities/:cityId',
    app.withGM({
      schema: {
        tags: ['Lore', 'Cities'],
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          required: ['loreId', 'cityId'],
          properties: {
            loreId: { type: 'string' },
            cityId: { type: 'string' },
          },
        },
        response: { 204: { description: 'No Content' } },
      },
    }),
    ctrl.link.bind(ctrl),
  );

  app.delete(
    '/api/lores/:loreId/cities/:cityId',
    app.withGM({
      schema: {
        tags: ['Lore', 'Cities'],
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          required: ['loreId', 'cityId'],
          properties: {
            loreId: { type: 'string' },
            cityId: { type: 'string' },
          },
        },
        response: { 204: { description: 'No Content' } },
      },
    }),
    ctrl.unlink.bind(ctrl),
  );
}
