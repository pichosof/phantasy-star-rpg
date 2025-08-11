import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RouteShorthandOptions,
  preHandlerHookHandler,
} from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    isGM?: boolean;
  }
  interface FastifyInstance {
    requireGM: (req: FastifyRequest, reply: FastifyReply) => Promise<void> | void;
    withGM<T extends RouteShorthandOptions>(opts?: T): T;
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  const gmKey = process.env.GM_API_KEY;
  if (!gmKey) {
    app.log.warn('GM_API_KEY não configurada — rotas mutáveis ficarão inseguras!');
  }

  app.decorateRequest('isGM', false);

  // preHandler de segurança
  app.decorate('requireGM', async (req: FastifyRequest, reply: FastifyReply) => {
    const provided = req.headers['x-api-key'] as string | undefined;
    if (!gmKey || provided !== gmKey) {
      await reply.code(401).send({ error: 'Unauthorized', message: 'GM key inválida' });
      return;
    }
    req.isGM = true;
  });

  // Helper para rotas mutáveis: adiciona preHandler + security no Swagger
  app.decorate('withGM', function withGM<
    T extends RouteShorthandOptions,
  >(this: FastifyInstance, opts?: T): T {
    const pre = opts?.preHandler;
    const gm: preHandlerHookHandler = this.requireGM;

    // Normaliza preHandlers existentes para array
    const preArray: preHandlerHookHandler[] = pre ? (Array.isArray(pre) ? pre : [pre]) : [];

    // Mescla schema + security
    const schema = {
      ...(opts?.schema ?? {}),
      security: [{ ApiKeyAuth: [] }],
    };

    // Retorna options mescladas
    return {
      ...(opts as object),
      preHandler: [...preArray, gm],
      schema,
    } as unknown as T;
  });
});
