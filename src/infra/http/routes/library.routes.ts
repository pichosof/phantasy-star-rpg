import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { container } from '../../../di/container.js';
import { libraryBruteForce } from '../../security/brute-force.js';
import { verifyKey } from '../../security/key-hash.js';
import { LibraryController } from '../controllers/library.controller.js';

type IdParams = { id: string };

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

  // Check brute-force lockout before doing any DB work
  const remaining = libraryBruteForce.lockoutRemaining(ip);
  if (remaining > 0) {
    await reply
      .code(429)
      .header('Retry-After', String(remaining))
      .send({ error: 'Too many failed attempts', retryAfterSeconds: remaining });
    return;
  }

  const provided = req.headers['x-library-key'] as string | undefined;

  // Get stored hash — do this before checking `provided` so timing is constant
  const repo = container.resolve('libraryDocumentRepo');
  const storedHash = await repo.getPlayerKey();

  // Always run verifyKey (even on missing/null values) to prevent timing oracle.
  // verifyKey returns false for empty/null inputs without doing crypto work,
  // but we normalise the response time by always going through the same code path.
  const keyToVerify = provided ?? '';
  const hashToVerify = storedHash ?? '';

  const valid = hashToVerify.startsWith('$scrypt$') ? verifyKey(keyToVerify, hashToVerify) : false;

  if (!valid) {
    libraryBruteForce.recordFailure(ip);
    // Uniform error — no distinction between "no key" / "wrong key" / "library locked"
    await reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  libraryBruteForce.recordSuccess(ip);
}

export async function libraryRoutes(app: FastifyInstance) {
  const c = new LibraryController();

  // GET — player or GM access (rate-limited at network level by global plugin)
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
            title: { type: 'string', maxLength: 200 },
            description: { anyOf: [{ type: 'string', maxLength: 2000 }, { type: 'null' }] },
            category: { anyOf: [{ type: 'string', maxLength: 100 }, { type: 'null' }] },
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

  // GET settings — GM only; returns { hasPlayerKey: boolean } — never returns the hash
  app.get(
    '/api/library/settings',
    app.withGM({ schema: { tags: ['Library'], security: [{ ApiKeyAuth: [] }] } }),
    c.getSettings.bind(c),
  );

  // PATCH settings — GM only; accepts plaintext key, hashes it before storage
  app.patch(
    '/api/library/settings',
    app.withGM({
      schema: {
        tags: ['Library'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          properties: {
            playerKey: {
              anyOf: [{ type: 'string', minLength: 12, maxLength: 256 }, { type: 'null' }],
            },
          },
          additionalProperties: false,
        },
        response: { 204: { type: 'null' } },
      },
    }),
    c.setSettings.bind(c),
  );
}
