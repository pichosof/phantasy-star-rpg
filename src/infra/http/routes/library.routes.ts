import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { container } from '../../../di/container.js';
import { LibraryController } from '../controllers/library.controller.js';

type IdParams = { id: string };

async function requireLibraryAccess(req: FastifyRequest, reply: FastifyReply) {
  if (req.isGM) return; // GM always has access
  const provided = req.headers['x-library-key'] as string | undefined;
  if (!provided) {
    await reply.code(401).send({ error: 'Unauthorized', message: 'Library key required' });
    return;
  }
  const repo = container.resolve('libraryDocumentRepo');
  const stored = await repo.getPlayerKey();
  if (!stored || provided !== stored) {
    await reply.code(401).send({ error: 'Unauthorized', message: 'Invalid library key' });
    return;
  }
  // Player authenticated — req.isGM stays false so the visibility filter will hide invisible docs
}

export async function libraryRoutes(app: FastifyInstance) {
  const c = new LibraryController();

  // GET — requires GM key OR valid player library key
  app.get(
    '/api/library/documents',
    {
      preHandler: [requireLibraryAccess],
      schema: { tags: ['Library'] },
    },
    c.list.bind(c),
  );

  // POST (upload) — GM only, multipart
  app.post(
    '/api/library/documents',
    app.withGM({ schema: { tags: ['Library'], security: [{ ApiKeyAuth: [] }] } }),
    c.upload.bind(c),
  );

  // PATCH — GM only
  app.patch<{ Params: IdParams }>(
    '/api/library/documents/:id',
    app.withGM({
      schema: {
        tags: ['Library'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            category: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            visible: { type: 'boolean' },
          },
          additionalProperties: false,
        },
        response: { 204: { type: 'null' } },
      },
    }),
    c.update.bind(c),
  );

  // DELETE — GM only
  app.delete<{ Params: IdParams }>(
    '/api/library/documents/:id',
    app.withGM({
      schema: {
        tags: ['Library'],
        security: [{ ApiKeyAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 204: { type: 'null' } },
      },
    }),
    c.delete.bind(c),
  );

  // GET settings — GM only
  app.get(
    '/api/library/settings',
    app.withGM({ schema: { tags: ['Library'], security: [{ ApiKeyAuth: [] }] } }),
    c.getSettings.bind(c),
  );

  // PATCH settings — GM only
  app.patch(
    '/api/library/settings',
    app.withGM({
      schema: {
        tags: ['Library'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          properties: { playerKey: { anyOf: [{ type: 'string' }, { type: 'null' }] } },
          additionalProperties: false,
        },
        response: { 204: { type: 'null' } },
      },
    }),
    c.setSettings.bind(c),
  );
}
