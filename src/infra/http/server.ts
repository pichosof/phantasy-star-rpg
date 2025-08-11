import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from '../config/env.js';
import { playerRoutes } from './routes/player.routes.js';
import { questRoutes } from './routes/quest.routes.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';

export async function buildServer() {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'production'
        ? { level: 'info' }
        : {
            level: 'debug',
            transport: { target: 'pino-pretty', options: { colorize: true } },
          },
  });

  await app.register(cors, { origin: env.CORS_ORIGIN || '*' });

  app.get('/api/health', async () => ({ ok: true, ts: new Date().toISOString() }));

  await app.register(playerRoutes);
  await app.register(questRoutes);
  await app.register(errorHandlerPlugin);

  return app;
}
