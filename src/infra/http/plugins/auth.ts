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
  const isProd = process.env.NODE_ENV === 'production';

  if (!gmKey && isProd) {
    throw new Error('GM_API_KEY is required in production');
  }
  if (!gmKey) {
    app.log.warn(
      'GM_API_KEY não configurada — rotas protegidas por GM ficarão indisponíveis (401).',
    );
  }

  app.decorateRequest('isGM', false);

  // Hook global: marca req.isGM em qualquer rota que envie a key válida
  app.addHook('onRequest', async (req: FastifyRequest) => {
    const provided = req.headers['x-api-key'] as string | undefined;
    if (gmKey && provided === gmKey) {
      req.isGM = true;
    }
  });

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
