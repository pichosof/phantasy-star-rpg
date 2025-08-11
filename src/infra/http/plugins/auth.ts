import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    isGM?: boolean;
  }
  interface FastifyInstance {
    requireGM: (req: FastifyRequest, reply: FastifyReply) => Promise<void> | void;
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  const gmKey = process.env.GM_API_KEY;
  if (!gmKey) {
    app.log.warn('GM_API_KEY não configurada — rotas mutáveis ficarão inseguras!');
  }

  app.decorateRequest('isGM', false);

  app.decorate('requireGM', async (req: FastifyRequest, reply: FastifyReply) => {
    const provided = req.headers['x-api-key'];
    if (!gmKey || provided !== gmKey) {
      await reply.code(401).send({ error: 'Unauthorized', message: 'GM key inválida' });
      return;
    }
    req.isGM = true;
  });
});
