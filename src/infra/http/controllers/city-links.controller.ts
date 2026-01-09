import type { FastifyReply, FastifyRequest } from 'fastify';
import { container } from '../../../di/container';

type Params = { id: string };

export class CityLinksController {
  private isGM(req: FastifyRequest) {
    const gmKey = process.env.GM_API_KEY;
    const apiKey = req.headers['x-api-key'];
    return Boolean(gmKey && apiKey && String(apiKey) === gmKey);
  }

  listLoresByCityId = async (req: FastifyRequest<{ Params: Params }>, reply: FastifyReply) => {
    const cityId = Number(req.params.id);
    if (!Number.isInteger(cityId) || cityId <= 0) {
      return reply.code(400).send({ message: 'invalid_city_id' });
    }

    const uc = container.resolve('listLoresByCityId');
    const items = await uc.execute(cityId, { includeHidden: this.isGM(req) });
    return reply.send(items);
  };

  listQuestsByCityId = async (req: FastifyRequest<{ Params: Params }>, reply: FastifyReply) => {
    const cityId = Number(req.params.id);
    if (!Number.isInteger(cityId) || cityId <= 0) {
      return reply.code(400).send({ message: 'invalid_city_id' });
    }

    const uc = container.resolve('listQuestsByCityId');
    const items = await uc.execute(cityId, { includeHidden: this.isGM(req) });
    return reply.send(items);
  };
}
