// src/infra/http/routes/monster.routes.ts
import type { FastifyInstance } from 'fastify';

import { MonsterController } from '../controllers/monster.controller.js';

export async function monsterRoutes(app: FastifyInstance) {
  const c = new MonsterController();

  // GET público
  app.get(
    '/api/bestiary',
    {
      schema: {
        tags: ['Bestiary'],
        response: {
          200: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
    },
    c.list.bind(c),
  );

  // POST protegido (criar monstro)
  app.post(
    '/api/bestiary',
    app.withGM({
      schema: {
        tags: ['Bestiary'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            species: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            habitat: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            discovered: { type: 'boolean', default: false },
            imageUrl: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            imageAlt: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
          additionalProperties: false,
        },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    }),
    c.create.bind(c),
  );

  // PATCH protegido (marcar como descoberto)
  app.patch(
    '/api/bestiary/:id/discovered',
    app.withGM({
      schema: {
        tags: ['Bestiary'],
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

  // PATCH protegido (atualizar imagem por URL)
  app.patch(
    '/api/bestiary/:id/image',
    app.withGM({
      schema: {
        tags: ['Bestiary'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string' },
            alt: { type: 'string' },
            mime: { type: 'string' },
            size: { type: 'number' },
          },
          additionalProperties: false,
        },
        response: { 204: { type: 'null' } },
      },
    }),
    c.updateImage.bind(c),
  );

  // DELETE protegido
  app.delete(
    '/api/bestiary/:id',
    app.withGM({
      schema: {
        tags: ['Bestiary'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 204: { type: 'null' } },
      },
    }),
    c.delete.bind(c),
  );
}
