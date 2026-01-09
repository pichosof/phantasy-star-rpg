import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import { createQuestInput } from '../../../core/use-cases/quest/create-quest';
import { updateQuestInput } from '../../../core/use-cases/quest/update-quest';
import { container } from '../../../di/container.js';

type CreateBody = z.infer<typeof createQuestInput>;
type UpdateBody = z.infer<typeof updateQuestInput>;
type IdParams = { id: string };

export class QuestController {
  private isGM(req: FastifyRequest) {
  const gmKey = (process.env.GM_API_KEY ?? '').trim();
  const apiKey = String(req.headers['x-api-key'] ?? '').trim();
  return Boolean(gmKey && apiKey && apiKey === gmKey);
}


  async list(req: FastifyRequest, reply: FastifyReply) {
    const uc = container.resolve('listQuests');
    const items = await uc.execute({ includeHidden: this.isGM(req) });
    return reply.send(items);
  }

  async create(req: FastifyRequest<{ Body: CreateBody }>, reply: FastifyReply) {
    const parsed = createQuestInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    const uc = container.resolve('createQuest');
    const res = await uc.execute(parsed.data);
    return reply.code(201).send(res);
  }

  async complete(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    const uc = container.resolve('completeQuest');
    await uc.execute({ id });
    return reply.code(204).send();
  }

  async update(req: FastifyRequest<{ Params: IdParams; Body: UpdateBody }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

    const parsed = updateQuestInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;

    await container.resolve('updateQuest').execute(id, parsed.data);
    return reply.code(204).send();
  }
}
