import type { FastifyReply, FastifyRequest } from 'fastify';

import { container } from '../../../di/container';

type Params = { questId: string; cityId: string };

export class QuestCityController {
  async link(req: FastifyRequest<{ Params: Params }>, reply: FastifyReply) {
    const q = Number(req.params.questId);
    const c = Number(req.params.cityId);
    if (!Number.isFinite(q) || !Number.isFinite(c)) {
      return reply.code(400).send({ error: 'Invalid ids' });
    }
    await container.resolve('linkQuestToCity').execute(q, c);
    return reply.code(204).send();
  }

  async unlink(req: FastifyRequest<{ Params: Params }>, reply: FastifyReply) {
    const q = Number(req.params.questId);
    const c = Number(req.params.cityId);
    if (!Number.isFinite(q) || !Number.isFinite(c)) {
      return reply.code(400).send({ error: 'Invalid ids' });
    }
    await container.resolve('unlinkQuestFromCity').execute(q, c);
    return reply.code(204).send();
  }
}
