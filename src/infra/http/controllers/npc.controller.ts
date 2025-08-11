import type { FastifyReply, FastifyRequest } from 'fastify';

import type { CreateNpcInput } from '../../../core/use-cases/npc/create-npc';
import { container } from '../../../di/container.js';

export class NpcController {
  async list(req: FastifyRequest, reply: FastifyReply) {
    return reply.send(await container.resolve('listNpcs').execute());
  }
  async create(req: FastifyRequest<{ Body: CreateNpcInput }>, reply: FastifyReply) {
    const res = await container.resolve('createNpc').execute(req.body);
    return reply.code(201).send(res);
  }
  async delete(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    await container.resolve('deleteNpc').execute({ id: Number(req.params.id) });
    return reply.code(204).send();
  }
  async updateImage(
    req: FastifyRequest<{
      Params: { id: string };
      Body: { url: string; alt?: string; mime?: string; size?: number };
    }>,
    reply: FastifyReply,
  ) {
    await container.resolve('updateNpcImage').execute({ id: Number(req.params.id), ...req.body });
    return reply.code(204).send();
  }
}
