import type { FastifyReply, FastifyRequest } from 'fastify';

import { container } from '../../../di/container';

type Params = { id: string };
type Body = { worldId: number | null };

export class CityWorldController {
  async setWorld(req: FastifyRequest<{ Params: Params; Body: Body }>, reply: FastifyReply) {
    const cityId = Number(req.params.id);
    const { worldId } = req.body;

    if (!Number.isFinite(cityId)) {
      return reply.code(400).send({ error: 'Invalid city id' });
    }
    if (worldId !== null && !Number.isFinite(Number(worldId))) {
      return reply.code(400).send({ error: 'Invalid worldId' });
    }

    if (worldId === null) {
      await container.resolve('removeCityFromWorld').execute(cityId);
    } else {
      await container.resolve('assignCityToWorld').execute(cityId, Number(worldId));
    }

    return reply.code(204).send();
  }

}
