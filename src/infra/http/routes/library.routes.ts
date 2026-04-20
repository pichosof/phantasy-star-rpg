import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { container } from '../../../di/container.js';
import { libraryBruteForce } from '../../security/brute-force.js';
import { verifyKey } from '../../security/key-hash.js';
import { LibraryController } from '../controllers/library.controller.js';

type IdParams = { id: string };

// Max upload size in bytes — gives 20 MB headroom above the configured limit for
// multipart envelope overhead. Fastify checks bodyLimit before @fastify/multipart
// can stream the body, so this must be at least as large as the file limit.
const UPLOAD_BODY_LIMIT = (Number(process.env.MAX_UPLOAD_MB || 30) + 20) * 1024 * 1024;

/**
 * Library access guard.
 *
 * Passes when:
 *   1. req.isGM === true (already validated by the global auth hook with timing-safe compare)
 *   2. OR the x-library-key header matches the stored scrypt hash AND the IP is not locked out.
 *
 * Failures:
 *   - Locked-out IP → 429 with Retry-After
 *   - Any auth failure (missing key, wrong key, no key configured) → identical 401
 *     (no oracle: same error body regardless of failure reason)
 */
async function requireLibraryAccess(req: FastifyRequest, reply: FastifyReply) {
  if (req.isGM) return;

  const ip = req.ip;

  const remaining = libraryBruteForce.lockoutRemaining(ip);
  if (remaining > 0) {
    await reply
      .code(429)
      .header('Retry-After', String(remaining))
      .send({ error: 'Too many failed attempts', retryAfterSeconds: remaining });
    return;
  }

  const provided = req.headers['x-library-key'] as string | undefined;

  const repo = container.resolve('libraryDocumentRepo');
  const storedHash = await repo.getPlayerKey();

  const keyToVerify  = provided ?? '';
  const hashToVerify = storedHash ?? '';

  const valid = hashToVerify.startsWith('$scrypt$') ? verifyKey(keyToVerify, hashToVerify) : false;

  if (!valid) {
    libraryBruteForce.recordFailure(ip);
    await reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  libraryBruteForce.recordSuccess(ip);
}

export async function libraryRoutes(app: FastifyInstance) {
  const c = new LibraryController();

  // GET list — player or GM
  app.get(
    '/api/library/documents',
    { preHandler: [requireLibraryAccess], schema: { tags: ['Library'] } },
    c.list.bind(c),
  );

  // POST upload — GM only.
  // bodyLimit is set per-route: Fastify enforces it before @fastify/multipart can
  // stream the body, so the route limit must be larger than the max file size.
  app.post(
    '/api/library/documents',
    app.withGM({
      bodyLimit: UPLOAD_BODY_LIMIT,
      schema: { tags: ['Library'], security: [{ BearerAuth: [] }] },
    }),
    c.upload.bind(c),
  );

  // GET download — player or GM; streams file with original filename + Range support
  app.get<{ Params: IdParams }>(
    '/api/library/documents/:id/download',
    {
      preHandler: [requireLibraryAccess],
      schema: {
        tags: ['Library'],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      },
    },
    c.download.bind(c),
  );

  // PATCH — GM only
  app.patch<{ Params: IdParams }>(
    '/api/library/documents/:id',
    app.withGM({
      schema: {
        tags: ['Library'],
        security: [{ BearerAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            title:       { type: 'string', maxLength: 200 },
            description: { anyOf: [{ type: 'string', maxLength: 2000 }, { type: 'null' }] },
            category:    { anyOf: [{ type: 'string', maxLength: 100 }, { type: 'null' }] },
            visible:     { type: 'boolean' },
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
        security: [{ BearerAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 204: { type: 'null' } },
      },
    }),
    c.delete.bind(c),
  );

  // GET settings — GM only
  app.get(
    '/api/library/settings',
    app.withGM({ schema: { tags: ['Library'], security: [{ BearerAuth: [] }] } }),
    c.getSettings.bind(c),
  );

  // PATCH settings — GM only
  app.patch(
    '/api/library/settings',
    app.withGM({
      schema: {
        tags: ['Library'],
        security: [{ BearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            playerKey: { anyOf: [{ type: 'string', minLength: 12, maxLength: 256 }, { type: 'null' }] },
          },
          additionalProperties: false,
        },
        response: { 204: { type: 'null' } },
      },
    }),
    c.setSettings.bind(c),
  );
}
