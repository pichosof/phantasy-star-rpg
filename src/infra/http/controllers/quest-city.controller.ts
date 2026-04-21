import type { FastifyReply, FastifyRequest } from 'fastify';

import { container } from '../../../di/container';

type Params = { questId: string; cityId: string };

export class QuestCityController {
  async listCities(req: FastifyRequest<{ Params: { questId: string } }>, reply: FastifyReply) {
    const q = Number(req.params.questId);
    if (!Number.isFinite(q)) return reply.code(400).send({ error: 'Invalid questId' });
    const linksRepo = container.resolve('linksRepo');
    const cities = await linksRepo.listCitiesByQuestId(q);
    return reply.send(cities);
  }

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
