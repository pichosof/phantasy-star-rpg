import path from 'node:path';

import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';

import { env } from '../config/env';

import { authPlugin } from './plugins/auth';
import { errorHandlerPlugin } from './plugins/error-handler';
import swaggerPlugin from './plugins/swagger';
import visibilityFilterPlugin from './plugins/visibility-filter';
import { cityWorldRoutes } from './routes/city-world.routes';
import { cityRoutes } from './routes/city.routes';
import { loreCityRoutes } from './routes/lore-city.routes';
import { loreRoutes } from './routes/lore.routes';
import { mapMarkerRoutes } from './routes/map-marker.routes';
import { monsterRoutes } from './routes/monster.routes';
import { npcRoutes } from './routes/npc.routes';
import { playerQuestRoutes } from './routes/player-quest.routes';
import { playerRoutes } from './routes/player.routes';
import { questCityRoutes } from './routes/quest-city.routes';
import { questRoutes } from './routes/quest.routes';
import { sessionRoutes } from './routes/session.routes';
import { timelineRoutes } from './routes/timeline.routes';
import { uploadRoutes } from './routes/upload.routes'; // novo
import { worldRoutes } from './routes/world.routes';

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
  await app.register(multipart, {
    limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 30) * 1024 * 1024 },
  });
  await app.register(fastifyStatic, {
    root: path.resolve('data', 'uploads'),
    prefix: '/files/',
    decorateReply: false,
  });

  app.get('/api/health', async () => ({ ok: true, ts: new Date().toISOString() }));
  await app.register(authPlugin);
  await app.register(visibilityFilterPlugin); 
  if (process.env.NODE_ENV !== 'production') {
    await app.register(swaggerPlugin);
  }

  // rotas...
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
  await app.register(worldRoutes);
  await app.register(cityWorldRoutes);
  await app.register(playerQuestRoutes);
  await app.register(questCityRoutes);
  await app.register(loreCityRoutes);

  await app.register(errorHandlerPlugin);

  return app;
}


