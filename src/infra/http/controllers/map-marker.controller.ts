import type { FastifyReply, FastifyRequest } from 'fastify';

import type { CreateMapMarkerInput } from '../../../core/use-cases/map-marker/create-map-marker.js';
import { container } from '../../../di/container.js';

export class MapMarkerController {
  async list(req: FastifyRequest, reply: FastifyReply) {
    return reply.send(await container.resolve('listMapMarkers').execute());
  }
  async create(req: FastifyRequest<{ Body: CreateMapMarkerInput }>, reply: FastifyReply) {
    const res = await container.resolve('createMapMarker').execute(req.body);
    return reply.code(201).send(res);
  }
  async setVisibility(
  req: FastifyRequest<{ Params: { id: string }; Body: { visible: boolean } }>,
  reply: FastifyReply
) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
  const { visible } = req.body;
  if (typeof visible !== 'boolean') return reply.code(400).send({ error: 'Invalid visible flag' });

  // Trocar a key pelo domínio correto:
  // players -> 'setPlayerVisibility', quests -> 'setQuestVisibility', etc.
  await container.resolve('setMapMarkerVisibility').execute(id, visible);
  return reply.code(204).send();
}
  async setDiscovered(
    req: FastifyRequest<{ Params: { id: string }; Body: { discovered: boolean } }>,
    reply: FastifyReply,
  ) {
    await container
      .resolve('setMapMarkerDiscovered')
      .execute({ id: Number(req.params.id), discovered: req.body.discovered });
    return reply.code(204).send();
  }
  async delete(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    await container.resolve('deleteMapMarker').execute({ id: Number(req.params.id) });
    return reply.code(204).send();
  }
}
