import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import { createLoreInput } from '../../../core/use-cases/lore/create-lore';
import { updateLoreInput } from '../../../core/use-cases/lore/update-lore';
import { container } from '../../../di/container';

type CreateBody = z.infer<typeof createLoreInput>;
type UpdateBody = z.infer<typeof updateLoreInput>;
type IdParams = { id: string };

export class LoreController {
  async list(_req: FastifyRequest, reply: FastifyReply) {
    const uc = container.resolve('listLores');
    const items = await uc.execute();
    return reply.code(200).send(items);
  }

  async create(req: FastifyRequest<{ Body: CreateBody }>, reply: FastifyReply) {
    const parsed = createLoreInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    const uc = container.resolve('createLore');
    const lore = await uc.execute(parsed.data);
    return reply.code(201).send(lore);
  }

  async update(req: FastifyRequest<{ Params: IdParams; Body: UpdateBody }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

    const parsed = updateLoreInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;

    await container.resolve('updateLore').execute(id, parsed.data);
    return reply.code(204).send();
  }

  async delete(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    await container.resolve('deleteLore').execute({ id: Number(req.params.id) });
    return reply.code(204).send();
  }
}
