import path from 'node:path';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';

import { env } from '../config/env';

import { authPlugin } from './plugins/auth';
import { clientAuthPlugin } from './plugins/client-auth';
import { errorHandlerPlugin } from './plugins/error-handler';
import swaggerPlugin from './plugins/swagger';
import visibilityFilterPlugin from './plugins/visibility-filter';
import { characterSheetsRoutes } from './routes/character-sheets.routes';
import { cityWorldRoutes } from './routes/city-world.routes';
import { cityRoutes } from './routes/city.routes';
import { dungeonRoutes } from './routes/dungeon.routes';
import { gmImagesRoutes } from './routes/gm-images.routes';
import { gmNotesRoutes } from './routes/gm-notes.routes';
import { libraryRoutes } from './routes/library.routes';
import { loreCityRoutes } from './routes/lore-city.routes';
import { loreRoutes } from './routes/lore.routes';
import { mapMarkerRoutes } from './routes/map-marker.routes';
import { monsterRoutes } from './routes/monster.routes';
import { npcRoutes } from './routes/npc.routes';
import { playerNotesRoutes } from './routes/player-notes.routes';
import { playerQuestRoutes } from './routes/player-quest.routes';
import { playerRoutes } from './routes/player.routes';
import { questCityRoutes } from './routes/quest-city.routes';
import { questRoutes } from './routes/quest.routes';
import { sessionRoutes } from './routes/session.routes';
import { tagsRoutes } from './routes/tags.routes';
import { timelineRoutes } from './routes/timeline.routes';
import { uploadRoutes } from './routes/upload.routes';
import { wikiRoutes } from './routes/wiki.routes';
import { worldRoutes } from './routes/world.routes';

export async function buildServer() {
  const isTest = process.env.NODE_ENV === 'test';
  const isProd = process.env.NODE_ENV === 'production';

  const app = Fastify({
    // Hard cap on raw JSON/text body size (file uploads go through multipart, not this limit)
    bodyLimit: 512 * 1024, // 512 KB
    logger: isTest
      ? false
      : {
          level: isProd ? 'info' : 'debug',
          transport:
            !isTest && !isProd ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
        },
  });

  // ── Security headers (Helmet) ────────────────────────────────────────────────
  // Must register before routes so headers are set on every response.
  await app.register(helmet, {
    // CSP: pure API server — serves no HTML/scripts/styles.
    // useDefaults: false prevents Helmet from merging its default directives
    // (font-src, img-src, style-src, upgrade-insecure-requests, etc.) with ours.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'none'"],
        'script-src': ["'none'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'none'"],
        'form-action': ["'none'"],
      },
    },
    // CORP: cross-origin — this is an API consumed by a cross-origin frontend.
    // same-origin would block the browser from reading the response body.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // COOP: same-origin — prevent cross-origin window references.
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    // Hide "server" and "x-powered-by" headers.
    hidePoweredBy: true,
    // Prevent MIME-type sniffing.
    noSniff: true,
    // Deny framing entirely.
    frameguard: { action: 'deny' },
    // X-XSS-Protection: 0 — disables the legacy browser XSS auditor (correct; the
    // auditor itself introduced vulnerabilities and is removed from modern browsers).
    xssFilter: false,
    // HSTS: 1 year, include subdomains, preload eligible (production only).
    hsts: isProd ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
    // Referrer: send nothing.
    referrerPolicy: { policy: 'no-referrer' },
    // X-Download-Options and X-Permitted-Cross-Domain-Policies from Helmet defaults.
    ieNoOpen: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    // X-DNS-Prefetch-Control: off — no DNS prefetching from API responses.
    dnsPrefetchControl: { allow: false },
  });

  // ── CORS ────────────────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: env.CORS_ORIGIN || (isProd ? false : '*'),
    allowedHeaders: [
      'content-type',
      'authorization',
      'x-client-id',
      'x-image-alt',
      'x-library-key',
      'x-doc-title',
      'x-doc-description',
      'x-doc-category',
    ],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    // Expose Retry-After so the frontend can read it on 429 responses.
    exposedHeaders: ['Retry-After'],
  });

  // ── Global rate limiter ──────────────────────────────────────────────────────
  // First line of defence against floods and enumeration at the HTTP level.
  await app.register(rateLimit, {
    global: true,
    max: 120, // 120 requests per window per IP
    timeWindow: 60_000, // 1-minute window
    // Expose standard headers so clients know their quota.
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    // Stricter limit for any route whose path contains "library" or "api-key" auth attempts.
    // Auth-level brute-force is handled by BruteForceGuard; this layer throttles volume.
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: (_req, context) => ({
      error: 'Too Many Requests',
      retryAfterMs: context.after,
    }),
  });

  // ── Multipart (file uploads) ─────────────────────────────────────────────────
  await app.register(multipart, {
    limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 30) * 1024 * 1024 },
  });

  // ── Static files ─────────────────────────────────────────────────────────────
  await app.register(fastifyStatic, {
    root: path.resolve('data', 'uploads'),
    prefix: '/files/',
    decorateReply: false,
  });

  // ── Health check (no rate limit applied — exempt via low cost) ───────────────
  app.get('/api/health', async () => ({ ok: true, ts: new Date().toISOString() }));

  // ── Client auth (x-client-id) ────────────────────────────────────────────────
  await app.register(clientAuthPlugin);

  // ── Auth + visibility filter ─────────────────────────────────────────────────
  await app.register(authPlugin);
  await app.register(visibilityFilterPlugin);

  // ── Swagger (dev only) ───────────────────────────────────────────────────────
  if (!isProd) {
    await app.register(swaggerPlugin);
  }

  // ── Application routes ───────────────────────────────────────────────────────
  await app.register(playerRoutes);
  await app.register(playerNotesRoutes);
  await app.register(questRoutes);
  await app.register(uploadRoutes);
  await app.register(npcRoutes);
  await app.register(sessionRoutes);
  await app.register(loreRoutes);
  await app.register(cityRoutes);
  await app.register(monsterRoutes);
  await app.register(mapMarkerRoutes);
  await app.register(timelineRoutes);
  await app.register(wikiRoutes);
  await app.register(worldRoutes);
  await app.register(cityWorldRoutes);
  await app.register(playerQuestRoutes);
  await app.register(questCityRoutes);
  await app.register(loreCityRoutes);
  await app.register(gmNotesRoutes);
  await app.register(gmImagesRoutes);
  await app.register(characterSheetsRoutes);
  await app.register(libraryRoutes);
  await app.register(dungeonRoutes);
  await app.register(tagsRoutes);

  await app.register(errorHandlerPlugin);

  return app;
}
