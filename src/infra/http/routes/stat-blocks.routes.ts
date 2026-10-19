import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { container } from '../../../di/container.js';

/** Combat stat blocks of bestiary entries (GM only: they are never shown to players). */
export async function statBlocksRoutes(app: FastifyInstance) {
  const gm = { schema: { tags: ['GM'], security: [{ ApiKeyAuth: [] }] } };

  app.get('/api/gm/bestiary/stat-blocks', app.withGM(gm), async () =>
    container.resolve('listStatBlocks').execute(),
  );

  app.put(
    '/api/gm/bestiary/:id/stat-blocks',
    app.withGM(gm),
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return reply.code(400).send({ error: 'Invalid id' });
      const body = req.body as { blocks?: unknown } | undefined;
      return container.resolve('setStatBlocks').execute(id, body?.blocks);
    },
  );
}
