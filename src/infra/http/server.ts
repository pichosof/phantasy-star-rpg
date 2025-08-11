import path from 'node:path';

import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';

import { env } from '../config/env.js';

import { errorHandlerPlugin } from './plugins/error-handler.js';
import { cityRoutes } from './routes/city.routes.js';
import { loreRoutes } from './routes/lore.routes.js';
import { mapMarkerRoutes } from './routes/map-marker.routes.js';
import { monsterRoutes } from './routes/monster.routes.js';
import { npcRoutes } from './routes/npc.routes.js';
import { playerRoutes } from './routes/player.routes.js';
import { questRoutes } from './routes/quest.routes.js';
import { sessionRoutes } from './routes/session.routes.js';
import { timelineRoutes } from './routes/timeline.routes.js';
import { uploadRoutes } from './routes/upload.routes.js'; // novo

export async function buildServer() {
  const isTest = process.env.NODE_ENV === 'test';

  const app = Fastify({
    logger: isTest
      ? false
      : {
          level: env.NODE_ENV === 'production' ? 'info' : 'debug',
          transport:
            !isTest && env.NODE_ENV !== 'production'
              ? { target: 'pino-pretty', options: { colorize: true } }
              : undefined,
        },
  });

  await app.register(cors, { origin: env.CORS_ORIGIN || '*' });
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB
  await app.register(fastifyStatic, {
    root: path.resolve('data', 'uploads'),
    prefix: '/files/', // serve /files/<nome>
    decorateReply: false,
  });

  app.get('/api/health', async () => ({ ok: true, ts: new Date().toISOString() }));

  await app.register(playerRoutes);
  await app.register(questRoutes);
  await app.register(uploadRoutes);
  await app.register(npcRoutes);
  await app.register(sessionRoutes);
  await app.register(loreRoutes);
  await app.register(cityRoutes);
  await app.register(monsterRoutes);
  await app.register(mapMarkerRoutes);
  await app.register(timelineRoutes);
  await app.register(errorHandlerPlugin);

  return app;
}
