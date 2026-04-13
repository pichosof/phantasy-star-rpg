import type { FastifyInstance } from 'fastify';

import { TimelineController } from '../controllers/timeline.controller.js';
export async function timelineRoutes(app: FastifyInstance) {
  const c = new TimelineController();

  // GET público
  app.get(
    '/api/timeline',
    {
      schema: {
        tags: ['Timeline'],
        response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
      },
    },
    c.list.bind(c),
  );

  // POST protegido
  app.post(
    '/api/timeline',
    app.withGM({
      schema: {
        tags: ['Timeline'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            date: { type: 'string' },
            occurredAt: { type: 'string' },
            description: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
          anyOf: [{ required: ['title', 'date'] }, { required: ['title', 'occurredAt'] }],
          additionalProperties: false,
        },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    }),
    c.create.bind(c),
  );

  // PATCH visibilidade protegido
  app.patch(
    '/api/timeline/:id/visibility',
    app.withGM({
      schema: {
        tags: ['Timeline'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['visible'],
          properties: { visible: { type: 'boolean' } },
          additionalProperties: false,
        },
        response: { 204: { type: 'null' } },
      },
    }),
    c.setVisibility.bind(c),
  );

  // PATCH edição protegido
  app.patch(
    '/api/timeline/:id',
    app.withGM({
      schema: {
        tags: ['Timeline'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            date: { type: 'string' },
            description: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
          additionalProperties: false,
        },
        response: { 204: { type: 'null' } },
      },
    }),
    c.update.bind(c),
  );

  // DELETE protegido
  app.delete(
    '/api/timeline/:id',
    app.withGM({
      schema: {
        tags: ['Timeline'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 204: { type: 'null' } },
      },
    }),
    c.delete.bind(c),
  );
}
