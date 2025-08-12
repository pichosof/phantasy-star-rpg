import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import type { CreateNpcInput } from '../../../core/use-cases/npc/create-npc';
import { updateNpcInput } from '../../../core/use-cases/npc/update-npc';
import { container } from '../../../di/container.js';

type UpdateBody = z.infer<typeof updateNpcInput>;

export class NpcController {
  async list(_req: FastifyRequest, reply: FastifyReply) {
    const items = await container.resolve('listNpcs').execute();
    return reply.send(items);
  }

  async create(req: FastifyRequest<{ Body: CreateNpcInput }>, reply: FastifyReply) {
    const res = await container.resolve('createNpc').execute(req.body);
    return reply.code(201).send(res);
  }

  async update(
    req: FastifyRequest<{ Params: { id: string }; Body: UpdateBody }>,
    reply: FastifyReply,
  ) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

    const parsed = updateNpcInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;

    await container.resolve('updateNpc').execute(id, parsed.data);
    return reply.code(204).send();
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
