import type { FastifyReply, FastifyRequest } from 'fastify';

import type { CreateCityInput } from '../../../core/use-cases/cities/create-city';
import { container } from '../../../di/container.js';

export class CityController {
  async list(req: FastifyRequest, reply: FastifyReply) {
    return reply.send(await container.resolve('listCities').execute());
  }
  async create(req: FastifyRequest<{ Body: CreateCityInput }>, reply: FastifyReply) {
    const res = await container.resolve('createCity').execute(req.body);
    return reply.code(201).send(res);
  }
  async setDiscovered(
    req: FastifyRequest<{ Params: { id: string }; Body: { discovered: boolean } }>,
    reply: FastifyReply,
  ) {
    await container
      .resolve('setCityDiscovered')
      .execute({ id: Number(req.params.id), discovered: req.body.discovered });
    return reply.code(204).send();
  }
  async delete(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    await container.resolve('deleteCity').execute({ id: Number(req.params.id) });
    return reply.code(204).send();
  }
}
