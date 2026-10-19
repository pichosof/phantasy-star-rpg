import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { isEntityType } from '../../../core/use-cases/links/link-text.js';
import { container } from '../../../di/container.js';

type Req = FastifyRequest & { isGM?: boolean };

/**
 * Wiki links between entities, and the GM session diary.
 * Link data is filtered by visibility inside the use-cases (players never see hidden entities).
 */
export async function linksRoutes(app: FastifyInstance) {
  const gm = { schema: { tags: ['GM'], security: [{ ApiKeyAuth: [] }] } };

  // Names that `[[...]]` links can point to.
  app.get('/api/links/index', { schema: { tags: ['Links'] } }, async (req: Req) =>
    container.resolve('getLinkIndex').execute(Boolean(req.isGM)),
  );

  // Preview of one entity + "Appears in" + history (timeline, sessions).
  app.get(
    '/api/links/:type/:id',
    { schema: { tags: ['Links'] } },
    async (req: FastifyRequest<{ Params: { type: string; id: string } }>, reply: FastifyReply) => {
      const id = Number(req.params.id);
      if (!isEntityType(req.params.type) || !Number.isInteger(id) || id <= 0) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return container
        .resolve('getEntityLinks')
        .execute(req.params.type, id, Boolean((req as Req).isGM));
    },
  );

  // ── Session diary (GM) ──
  type SessionReq = FastifyRequest<{ Params: { id: string } }>;
  const sessionId = (req: SessionReq, reply: FastifyReply) => {
    const id = Number(req.params.id);
    if (Number.isInteger(id) && id > 0) return id;
    void reply.code(400).send({ error: 'Invalid id' });
    return null;
  };

  app.get('/api/gm/ai/status', app.withGM(gm), async () => ({
    enabled: container.resolve('summarizeSessionDiary').enabled,
  }));

  app.get('/api/gm/sessions/:id/diary', app.withGM(gm), async (req: SessionReq, reply) => {
    const id = sessionId(req, reply);
    return id === null ? reply : container.resolve('getSessionDiary').execute(id);
  });

  app.put('/api/gm/sessions/:id/diary', app.withGM(gm), async (req: SessionReq, reply) => {
    const id = sessionId(req, reply);
    return id === null ? reply : container.resolve('saveSessionDiary').execute(id, req.body);
  });

  app.post(
    '/api/gm/sessions/:id/diary/summarize',
    // Each call costs money: keep it to a handful per minute.
    app.withGM({ ...gm, config: { rateLimit: { max: 6, timeWindow: 60_000 } } }),
    async (req: SessionReq, reply) => {
      const id = sessionId(req, reply);
      return id === null ? reply : container.resolve('summarizeSessionDiary').execute(id, req.body);
    },
  );
}
