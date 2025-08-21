import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

function hasVisible(x: unknown): x is { visible?: boolean } {
  return typeof x === 'object' && x !== null && 'visible' in (x as Record<string, unknown>);
}

export default fp(async (app: FastifyInstance) => {
  app.addHook('preSerialization', (_req, _reply, payload, done) => {
    // Tipagem do Fastify é ampla (unknown) aqui; tratamos só o caso de lista.
    const req: any = _req; // leitura de isGM (decorated) sem afetar os tipos de payload
    if (_req.method === 'GET' && !req.isGM && Array.isArray(payload)) {
      const filtered = payload.filter((item) => !hasVisible(item) || item.visible !== false);
      return done(null, filtered);
    }
    return done(null, payload);
  });
});
