// src/infra/http/plugins/visibility-filter.ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Reads `visible` from what the item will actually serialize to. Entities keep their
 * fields in `props` and expose them via `toJSON()`, so `'visible' in item` is false
 * for them — checking the raw object let hidden entities through to players.
 */
function isHidden(item: unknown): boolean {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as { toJSON?: () => unknown; props?: unknown; visible?: unknown };
  const shape =
    typeof obj.toJSON === 'function'
      ? obj.toJSON()
      : obj.props && typeof obj.props === 'object' && !('visible' in obj)
        ? obj.props
        : obj;
  return (shape as { visible?: unknown } | null)?.visible === false;
}

export default fp(async (app: FastifyInstance) => {
  app.addHook(
    'preSerialization',
    async (req: FastifyRequest, _reply: FastifyReply, payload: unknown) => {
      // Só filtra GET para não-GM e quando o payload é array
      if (req.method === 'GET' && !req.isGM && Array.isArray(payload)) {
        return payload.filter((item) => !isHidden(item));
      }
      return payload;
    },
  );
});
