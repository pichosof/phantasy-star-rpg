import fJwt from '@fastify/jwt';
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RouteShorthandOptions,
  preHandlerHookHandler,
} from 'fastify';
import fp from 'fastify-plugin';

import { gmBruteForce } from '../../security/brute-force.js';
import { safeCompare } from '../../security/safe-compare.js';

declare module 'fastify' {
  interface FastifyRequest {
    isGM?: boolean;
  }
  interface FastifyInstance {
    requireGM: (req: FastifyRequest, reply: FastifyReply) => Promise<void> | void;
    withGM<T extends RouteShorthandOptions>(opts?: T): T;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: string };
  }
}

/** Validates that the GM key meets minimum entropy requirements. */
function validateGMKeyStrength(key: string): void {
  if (key.length < 24) {
    throw new Error('GM_API_KEY must be at least 24 characters.');
  }
  const classes = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(key)).length;
  if (classes < 3) {
    throw new Error(
      'GM_API_KEY must contain at least 3 character classes (upper, lower, digits, symbols).',
    );
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  const gmKey = process.env.GM_API_KEY;
  const jwtSecret = process.env.JWT_SECRET;
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? '8h';
  const isProd = process.env.NODE_ENV === 'production';

  if (!gmKey && isProd) {
    throw new Error('GM_API_KEY is required in production.');
  }
  if (!jwtSecret && isProd) {
    throw new Error('JWT_SECRET is required in production.');
  }

  if (gmKey) {
    try {
      validateGMKeyStrength(gmKey);
    } catch (e) {
      if (isProd) throw e;
      app.log.warn(`[auth] GM_API_KEY strength warning: ${(e as Error).message}`);
    }
  } else {
    app.log.warn('[auth] GM_API_KEY not set — all GM routes will return 401.');
  }

  await app.register(fJwt, {
    secret: jwtSecret ?? 'dev-jwt-secret-change-me-in-production',
  });

  app.decorateRequest('isGM', false);

  // Global hook: marks req.isGM=true when a valid GM JWT is in the Authorization header.
  app.addHook('onRequest', async (req: FastifyRequest) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return;

    try {
      const decoded = await req.jwtVerify<{ role: string }>();
      if (decoded.role === 'gm') {
        req.isGM = true;
      }
    } catch {
      // expired or tampered token — req.isGM stays false
    }
  });

  // Login endpoint: exchanges GM_API_KEY for a short-lived JWT.
  // The raw key is never transmitted after this point.
  app.post(
    '/api/auth/login',
    {
      schema: {
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['apiKey'],
          properties: { apiKey: { type: 'string' } },
          additionalProperties: false,
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { apiKey } = req.body as { apiKey: string };
      const ip = req.ip;

      const remaining = gmBruteForce.lockoutRemaining(ip);
      if (remaining > 0) {
        return reply
          .code(429)
          .header('Retry-After', String(remaining))
          .send({ error: 'Too many failed attempts', retryAfterSeconds: remaining });
      }

      const keyValid = gmKey ? safeCompare(apiKey ?? '', gmKey) : false;
      if (!keyValid) {
        gmBruteForce.recordFailure(ip);
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      gmBruteForce.recordSuccess(ip);

      const token = app.jwt.sign({ sub: 'gm', role: 'gm' }, { expiresIn: jwtExpiresIn });
      const decoded = app.jwt.decode<{ exp: number }>(token);
      const expiresAt = decoded ? new Date(decoded.exp * 1000).toISOString() : null;

      app.log.info({ ip }, '[auth] GM login — JWT issued');
      return reply.send({ token, expiresAt });
    },
  );

  // Pre-handler for GM-protected routes.
  app.decorate('requireGM', async (req: FastifyRequest, reply: FastifyReply) => {
    const ip = req.ip;
    const remaining = gmBruteForce.lockoutRemaining(ip);

    if (remaining > 0) {
      await reply
        .code(429)
        .header('Retry-After', String(remaining))
        .send({ error: 'Too many failed attempts', retryAfterSeconds: remaining });
      return;
    }

    if (!req.isGM) {
      await reply.code(401).send({ error: 'Unauthorized' });
      return;
    }
  });

  // Shorthand helper: wraps route options to inject requireGM preHandler + Swagger security tag.
  app.decorate('withGM', function withGM<
    T extends RouteShorthandOptions,
  >(this: FastifyInstance, opts?: T): T {
    const pre = opts?.preHandler;
    const gm: preHandlerHookHandler = this.requireGM;
    const preArray: preHandlerHookHandler[] = pre ? (Array.isArray(pre) ? pre : [pre]) : [];
    const schema = { ...(opts?.schema ?? {}), security: [{ BearerAuth: [] }] };
    return { ...(opts as object), preHandler: [...preArray, gm], schema } as unknown as T;
  });
});
