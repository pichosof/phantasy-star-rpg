import type { FastifyInstance } from 'fastify';

import { NpcController } from '../controllers/npc.controller.js';
type IdParams = { id: string };
type VisibilityBody = { visible: boolean };
export async function npcRoutes(app: FastifyInstance) {
  const ctrl = new NpcController();

  // GET público
  app.get(
    '/api/npcs',
    {
      schema: {
        tags: ['NPCs'],
        response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
      },
    },
    ctrl.list.bind(ctrl),
  );
  app.patch<{ Params: IdParams; Body: VisibilityBody }>(
    '/api/npcs/:id/visibility',
    app.withGM({
      schema: {
        tags: ['NPCs'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['visible'],
          properties: { visible: { type: 'boolean' } },
          additionalProperties: false,
        },
        response: { 204: { description: 'No Content' } },
      },
    }),
    ctrl.setVisibility.bind(ctrl),
  );
  // POST protegido
  app.post(
    '/api/npcs',
    app.withGM({
      schema: {
        tags: ['NPCs'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            role: { type: 'string', nullable: true },
            description: { type: 'string', nullable: true },
            location: { type: 'string', nullable: true },
            imageUrl: { type: 'string', nullable: true },
            imageAlt: { type: 'string', nullable: true },
          },
          additionalProperties: false,
        },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    }),
    ctrl.create.bind(ctrl),
  );

  // PATCH update protegido
  app.patch(
    '/api/npcs/:id',
    app.withGM({
      schema: {
        tags: ['NPCs'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            role: { type: 'string', nullable: true },
            description: { type: 'string', nullable: true },
            location: { type: 'string', nullable: true },
            imageUrl: { type: 'string', nullable: true },
            imageAlt: { type: 'string', nullable: true },
          },
          additionalProperties: false,
        },
        response: { 204: { description: 'No Content' } },
      },
    }),
    ctrl.update.bind(ctrl),
  );

  // DELETE protegido
  app.delete(
    '/api/npcs/:id',
    app.withGM({
      schema: {
        tags: ['NPCs'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 204: { description: 'No Content' } },
      },
    }),
    ctrl.delete.bind(ctrl),
  );

  // PATCH sheet (PDF) protegido
  app.patch(
    '/api/npcs/:id/sheet',
    app.withGM({
      schema: {
        tags: ['NPCs'],
        security: [{ ApiKeyAuth: [] }],
        consumes: ['multipart/form-data'],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 204: { description: 'No Content' } },
      },
    }),
    ctrl.updateSheet.bind(ctrl),
  );

  // PATCH imagem protegido (multipart)
  app.patch(
    '/api/npcs/:id/image',
    app.withGM({
      schema: {
        tags: ['NPCs'],
        security: [{ ApiKeyAuth: [] }],
        consumes: ['multipart/form-data'],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 204: { description: 'No Content' } },
      },
    }),
    ctrl.updateImage.bind(ctrl),
  );
}
