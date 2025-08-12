import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import { createCityInput } from '../../../core/use-cases/cities/create-city';
import { setCityDiscoveredInput } from '../../../core/use-cases/cities/set-city-discovered';
import { updateCityInput } from '../../../core/use-cases/cities/update-city';
import { container } from '../../../di/container';

type IdParams = { id: string };
type CreateBody = z.infer<typeof createCityInput>;
type UpdateBody = z.infer<typeof updateCityInput>;
type DiscoverBody = z.infer<typeof setCityDiscoveredInput>;

export class CityController {
  async list(_req: FastifyRequest, reply: FastifyReply) {
    const uc = container.resolve('listCities');
    const items = await uc.execute();
    return reply.code(200).send(items);
  }

  async create(req: FastifyRequest<{ Body: CreateBody }>, reply: FastifyReply) {
    const parsed = createCityInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    const uc = container.resolve('createCity');
    const city = await uc.execute(parsed.data);
    return reply.code(201).send(city);
  }

  async setDiscovered(
    req: FastifyRequest<{ Params: IdParams; Body: DiscoverBody }>,
    reply: FastifyReply,
  ) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return reply.code(400).send({ error: 'Invalid id' });
    }

    const parsed = setCityDiscoveredInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;

    await container
      .resolve('setCityDiscovered')
      .execute({ id, discovered: parsed.data.discovered });

    return reply.code(204).send();
  }

  async update(req: FastifyRequest<{ Params: IdParams; Body: UpdateBody }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

    const parsed = updateCityInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;

    await container.resolve('updateCity').execute(id, parsed.data);
    return reply.code(204).send();
  }

  async delete(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    await container.resolve('deleteCity').execute({ id: Number(req.params.id) });
    return reply.code(204).send();
  }
}
