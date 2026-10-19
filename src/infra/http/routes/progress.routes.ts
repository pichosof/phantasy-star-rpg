import type { FastifyInstance, FastifyReply } from 'fastify';

import { container } from '../../../di/container.js';

type IdRoute = { Params: { id: string } };

const idOf = (raw: string, reply: FastifyReply) => {
  const id = Number(raw);
  if (Number.isInteger(id) && id > 0) return id;
  void reply.code(400).send({ error: 'Invalid id' });
  return null;
};

/** Player progression: XP and credits awarded per session. */
export async function progressRoutes(app: FastifyInstance) {
  const gm = { schema: { tags: ['GM'], security: [{ ApiKeyAuth: [] }] } };

  // Visible to players for visible players (hidden session titles are blanked).
  app.get<IdRoute>(
    '/api/players/:id/progress',
    { schema: { tags: ['Players'] } },
    async (req, reply) => {
      const id = idOf(req.params.id, reply);
      const isGM = Boolean((req as { isGM?: boolean }).isGM);
      return id === null ? reply : container.resolve('getPlayerProgress').execute(id, isGM);
    },
  );

  app.get<IdRoute>('/api/gm/sessions/:id/rewards', app.withGM(gm), async (req, reply) => {
    const id = idOf(req.params.id, reply);
    return id === null ? reply : container.resolve('getSessionRewards').execute(id);
  });

  app.put<IdRoute>('/api/gm/sessions/:id/rewards', app.withGM(gm), async (req, reply) => {
    const id = idOf(req.params.id, reply);
    return id === null ? reply : container.resolve('setSessionRewards').execute(id, req.body);
  });
}
