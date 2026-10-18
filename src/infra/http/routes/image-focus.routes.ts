import type { FastifyInstance } from 'fastify';

import { ImageFocusDrizzleRepository } from '../../repositories/image-focus.drizzle.repository.js';
import { extractStorageKeyFromUrl, normalizeStorageKey } from '../../storage/file-storage.utils.js';

const MAX_KEYS = 200;

/** Accepts either a storage key or a /files/... URL. */
function toKey(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const key = v.startsWith('/files/') ? extractStorageKeyFromUrl(v) : normalizeStorageKey(v);
  return key && !key.includes('..') ? key : null;
}

export async function imageFocusRoutes(app: FastifyInstance) {
  const repo = new ImageFocusDrizzleRepository();

  // Public, but only answers for keys the caller already holds (no listing of image URLs).
  app.get<{ Querystring: { keys?: string } }>(
    '/api/image-focus',
    {
      schema: {
        tags: ['Images'],
        querystring: { type: 'object', properties: { keys: { type: 'string' } } },
      },
    },
    async (req) => {
      const keys = (req.query.keys ?? '')
        .split(',')
        .map((k) => toKey(decodeURIComponent(k)))
        .filter((k): k is string => Boolean(k))
        .slice(0, MAX_KEYS);
      return repo.findByKeys([...new Set(keys)]);
    },
  );

  app.put<{ Body: { key: string; x: number; y: number } }>(
    '/api/gm/image-focus',
    app.withGM({
      schema: {
        tags: ['Images'],
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['key', 'x', 'y'],
          properties: {
            key: { type: 'string', minLength: 1, maxLength: 1024 },
            x: { type: 'number', minimum: 0, maximum: 100 },
            y: { type: 'number', minimum: 0, maximum: 100 },
          },
          additionalProperties: false,
        },
      },
    }),
    async (req, reply) => {
      const key = toKey(req.body.key);
      if (!key) return reply.code(400).send({ error: 'Invalid key' });
      const focus = {
        key,
        x: Math.round(req.body.x * 10) / 10,
        y: Math.round(req.body.y * 10) / 10,
      };
      await repo.upsert(focus);
      return focus;
    },
  );
}
