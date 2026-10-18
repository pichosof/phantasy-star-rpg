import type { FastifyReply, FastifyRequest } from 'fastify';

import { container } from '../../../di/container';

type Params = { id: string };

export class CityLinksController {
  private isGM(req: FastifyRequest) {
    return req.isGM === true;
  }

  /** Players get 404 for sub-resources of a hidden city, as if it didn't exist. */
  private async isHiddenFromCaller(req: FastifyRequest, cityId: number) {
    if (this.isGM(req)) return false;
    const city = await container.resolve('cityRepo').findById(cityId);
    return !city || city.visible === false;
  }

  listLoresByCityId = async (req: FastifyRequest<{ Params: Params }>, reply: FastifyReply) => {
    const cityId = Number(req.params.id);
    if (!Number.isInteger(cityId) || cityId <= 0) {
      return reply.code(400).send({ message: 'invalid_city_id' });
    }
    if (await this.isHiddenFromCaller(req, cityId)) {
      return reply.code(404).send({ message: 'city_not_found' });
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
    if (await this.isHiddenFromCaller(req, cityId)) {
      return reply.code(404).send({ message: 'city_not_found' });
    }

    const uc = container.resolve('listQuestsByCityId') as {
      execute: (cityId: number, opts?: { includeHidden?: boolean }) => Promise<unknown[]>;
    };

    const items = await uc.execute(cityId, { includeHidden: this.isGM(req) });
    return reply.send(items);
  };
}
