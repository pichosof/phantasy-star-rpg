import type { FastifyInstance } from 'fastify';

import { SessionController } from '../controllers/session.controller.js';

export async function sessionRoutes(app: FastifyInstance) {
  const c = new SessionController();

  // GET público
  app.get(
    '/api/sessions',
    {
      schema: {
        tags: ['Sessions'],
        response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
      },
    },
    c.list.bind(c),
  );

  // POST protegido
  app.post(
    '/api/sessions',
    app.withGM({
      schema: {
        tags: ['Sessions'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['title', 'date'],
          properties: {
            title: { type: 'string' },
            date: { type: 'string' }, // ISO string
            summary: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
          additionalProperties: false,
        },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    }),
    c.create.bind(c),
  );

  // 👇 PATCH protegido
  app.patch(
    '/api/sessions/:id',
    app.withGM({
      schema: {
        tags: ['Sessions'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            date: { type: 'string' }, // ISO string
            summary: { anyOf: [{ type: 'string' }, { type: 'null' }] },
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
    '/api/sessions/:id',
    app.withGM({
      schema: {
        tags: ['Sessions'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 204: { type: 'null' } },
      },
    }),
    c.delete.bind(c),
  );
}
