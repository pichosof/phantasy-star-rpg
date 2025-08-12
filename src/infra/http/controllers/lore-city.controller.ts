import type { FastifyReply, FastifyRequest } from 'fastify';

import { container } from '../../../di/container';

type Params = { loreId: string; cityId: string };

export class LoreCityController {
  async link(req: FastifyRequest<{ Params: Params }>, reply: FastifyReply) {
    const l = Number(req.params.loreId);
    const c = Number(req.params.cityId);
    if (!Number.isFinite(l) || !Number.isFinite(c)) {
      return reply.code(400).send({ error: 'Invalid ids' });
    }
    await container.resolve('linkLoreToCity').execute(l, c);
    return reply.code(204).send();
  }

  async unlink(req: FastifyRequest<{ Params: Params }>, reply: FastifyReply) {
    const l = Number(req.params.loreId);
    const c = Number(req.params.cityId);
    if (!Number.isFinite(l) || !Number.isFinite(c)) {
      return reply.code(400).send({ error: 'Invalid ids' });
    }
    await container.resolve('unlinkLoreFromCity').execute(l, c);
    return reply.code(204).send();
  }
}
