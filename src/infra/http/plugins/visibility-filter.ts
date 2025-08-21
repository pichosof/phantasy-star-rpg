// src/infra/http/plugins/visibility-filter.ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

function hasVisible(x: unknown): x is { visible?: boolean } {
  return typeof x === 'object' && x !== null && 'visible' in (x as Record<string, unknown>);
}

export default fp(async (app: FastifyInstance) => {
  app.addHook(
    'preSerialization',
    async (req: FastifyRequest, _reply: FastifyReply, payload: unknown) => {
      // Só filtra GET para não-GM e quando o payload é array
      if (req.method === 'GET' && !req.isGM && Array.isArray(payload)) {
        const filtered = payload.filter((item) => !hasVisible(item) || item.visible !== false);
        return filtered; 
      }
      return payload;
    }
  );
});
