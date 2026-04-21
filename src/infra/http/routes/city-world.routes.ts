import type { FastifyInstance } from 'fastify';

import { CityWorldController } from '../controllers/city-world.controller';

export async function cityWorldRoutes(app: FastifyInstance) {
  const c = new CityWorldController();

  app.patch(
    '/api/cities/:id/world',
    app.withGM({
      schema: {
        tags: ['Cities'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['worldId'],
          properties: { worldId: { type: 'number', nullable: true } },
          additionalProperties: false,
        },
        response: { 204: { description: 'No Content' } },
      },
    }),
    c.setWorld.bind(c),
  );
}
