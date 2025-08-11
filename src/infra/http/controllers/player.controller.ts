import { FastifyReply, FastifyRequest } from 'fastify';
import { container } from '../../../di/container.js';

export class PlayerController {
  async list(req: FastifyRequest, reply: FastifyReply) {
    const uc = container.resolve('listPlayers');
    const result = await uc.execute();
    return reply.send(result);
  }

  async create(
    req: FastifyRequest<{ Body: { name: string; level?: number; background?: string | null } }>,
    reply: FastifyReply,
  ) {
    const uc = container.resolve('createPlayer');
    const result = await uc.execute(req.body);
    return reply.code(201).send(result);
  }
}
