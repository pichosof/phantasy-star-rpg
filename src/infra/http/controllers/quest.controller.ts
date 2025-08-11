import { FastifyReply, FastifyRequest } from 'fastify';
import { container } from '../../../di/container.js';

export class QuestController {
  async list(req: FastifyRequest, reply: FastifyReply) {
    const uc = container.resolve('listQuests');
    return reply.send(await uc.execute());
  }
  async create(
    req: FastifyRequest<{ Body: { title: string; description?: string; reward?: string } }>,
    reply: FastifyReply,
  ) {
    const uc = container.resolve('createQuest');
    const res = await uc.execute(req.body);
    return reply.code(201).send(res);
  }
  async complete(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const uc = container.resolve('completeQuest');
    await uc.execute({ id: Number(req.params.id) });
    return reply.code(204).send();
  }
}
