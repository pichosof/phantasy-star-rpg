import type { FastifyReply, FastifyRequest } from 'fastify';

import type { CreateLoreInput } from '../../../core/use-cases/lore/create-lore';
import { container } from '../../../di/container.js';

export class LoreController {
  async list(req: FastifyRequest, reply: FastifyReply) {
    return reply.send(await container.resolve('listLores').execute());
  }
  async create(req: FastifyRequest<{ Body: CreateLoreInput }>, reply: FastifyReply) {
    const res = await container.resolve('createLore').execute(req.body);
    return reply.code(201).send(res);
  }
  async delete(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    await container.resolve('deleteLore').execute({ id: Number(req.params.id) });
    return reply.code(204).send();
  }
}
