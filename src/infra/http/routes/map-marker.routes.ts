import type { FastifyInstance } from 'fastify';

import { MapMarkerController } from '../controllers/map-marker.controller.js';

export async function mapMarkerRoutes(app: FastifyInstance) {
  const c = new MapMarkerController();

  // GET público
  app.get(
    '/api/map-markers',
    {
      schema: {
        tags: ['MapMarkers'],
        response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
      },
    },
    c.list.bind(c),
  );

  // POST protegido
  app.post(
    '/api/map-markers',
    app.withGM({
      schema: {
        tags: ['MapMarkers'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'type'],
          properties: {
            name: { type: 'string' },
            description: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            type: { enum: ['city', 'dungeon', 'npc', 'poi'] },
            coordinates: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            discovered: { type: 'boolean', default: false },
          },
          additionalProperties: false,
        },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    }),
    c.create.bind(c),
  );

  // PATCH /discovered protegido
  app.patch(
    '/api/map-markers/:id/discovered',
    app.withGM({
      schema: {
        tags: ['MapMarkers'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['discovered'],
          properties: { discovered: { type: 'boolean' } },
          additionalProperties: false,
        },
        response: { 204: { type: 'null' } },
      },
    }),
    c.setDiscovered.bind(c),
  );

  // DELETE protegido
  app.delete(
    '/api/map-markers/:id',
    app.withGM({
      schema: {
        tags: ['MapMarkers'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 204: { type: 'null' } },
      },
    }),
    c.delete.bind(c),
  );
}
