/**
 * Client authentication plugin.
 *
 * Enforces that every /api/* request comes from a known frontend client by
 * requiring a shared secret in the `x-client-id` header.
 *
 * Why this matters despite CORS:
 *   CORS is enforced by browsers — it does nothing to stop curl, Postman,
 *   scripts, or bots. This plugin closes that gap.
 *
 * How it works:
 *   - The frontend embeds CLIENT_SECRET (a build-time env var) and injects it
 *     as `x-client-id` on every Axios request.
 *   - The backend compares it with timing-safe HMAC to prevent enumeration.
 *   - Missing or wrong header → 403 (generic — no information about why).
 *
 * Exempt paths:
 *   - GET /api/health  — monitoring tools must reach this without credentials
 *   - /files/*         — static file serving (URLs are already unguessable UUIDs)
 *
 * Origin validation (secondary layer, production only):
 *   - If CORS_ORIGIN is set to a specific URL (not "*"), we additionally check
 *     that the `Origin` request header matches. This stops CSRF from other
 *     browser-based pages. Origin is not present on curl/Postman by default
 *     (so the client-id check remains the primary gate).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { safeCompare } from '../../security/safe-compare.js';

const EXEMPT_PATHS = new Set(['/api/health']);
const EXEMPT_PREFIX = '/files/';

export const clientAuthPlugin = fp(async (app: FastifyInstance) => {
  const clientSecret = process.env.CLIENT_SECRET;
  const corsOrigin = process.env.CORS_ORIGIN ?? '*';
  const isProd = process.env.NODE_ENV === 'production';

  if (!clientSecret) {
    if (isProd) {
      throw new Error('CLIENT_SECRET is required in production.');
    }
    app.log.warn(
      '[client-auth] CLIENT_SECRET not set — all /api/* requests will pass without client validation.',
    );
  }

  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const { url, method } = req;

    // Strip query string for path matching
    const path = url.split('?')[0];

    // Exempt paths
    if (EXEMPT_PATHS.has(path) || path.startsWith(EXEMPT_PREFIX)) return;

    // Only gate /api/* routes
    if (!path.startsWith('/api/')) return;

    // ── Primary gate: x-client-id header ────────────────────────────────────
    if (clientSecret) {
      const provided = req.headers['x-client-id'] as string | undefined;

      // Always run safeCompare even when header is absent — prevents timing oracle
      // on the presence/absence of the header itself.
      const candidate = provided ?? '';
      const valid = safeCompare(candidate, clientSecret);

      if (!valid) {
        app.log.warn(
          { ip: req.ip, method, path },
          '[client-auth] rejected: invalid or missing x-client-id',
        );
        await reply.code(403).send({ error: 'Forbidden' });
        return;
      }
    }

    // ── Secondary gate: Origin validation (prod only, non-wildcard CORS) ────
    // Browsers always send Origin on cross-origin requests and on same-origin
    // POST/PUT/PATCH/DELETE requests. Missing Origin on a state-changing route
    // is suspicious (typical of curl/Postman without explicit header spoofing).
    if (isProd && corsOrigin !== '*') {
      const origin = req.headers['origin'] as string | undefined;
      const referer = req.headers['referer'] as string | undefined;

      // GET and HEAD are safe-methods and may not carry Origin
      const isSafeMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

      if (!isSafeMethod && origin) {
        // origin is present — validate it
        if (!safeCompare(origin.replace(/\/$/, ''), corsOrigin.replace(/\/$/, ''))) {
          app.log.warn({ ip: req.ip, origin, path }, '[client-auth] rejected: Origin mismatch');
          await reply.code(403).send({ error: 'Forbidden' });
          return;
        }
      }

      if (!isSafeMethod && !origin && referer) {
        // Some browsers omit Origin on same-origin redirects but include Referer
        try {
          const refOrigin = new URL(referer).origin;
          if (!safeCompare(refOrigin, corsOrigin.replace(/\/$/, ''))) {
            app.log.warn({ ip: req.ip, referer, path }, '[client-auth] rejected: Referer mismatch');
            await reply.code(403).send({ error: 'Forbidden' });
            return;
          }
        } catch {
          // malformed Referer — reject
          await reply.code(403).send({ error: 'Forbidden' });
          return;
        }
      }

      // In production, deny state-changing requests with no origin indicator at all
      // (neither Origin nor Referer) — this is always curl/script, never a browser.
      if (!isSafeMethod && !origin && !referer) {
        app.log.warn(
          { ip: req.ip, method, path },
          '[client-auth] rejected: no Origin or Referer on state-changing request',
        );
        await reply.code(403).send({ error: 'Forbidden' });
        return;
      }
    }
  });
});
