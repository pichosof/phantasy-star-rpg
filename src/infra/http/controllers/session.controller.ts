import type { FastifyReply, FastifyRequest } from 'fastify';

import type { CreateSessionInput } from '../../../core/use-cases/session/create-session';
import { container } from '../../../di/container.js';

export class SessionController {
  async list(req: FastifyRequest, reply: FastifyReply) {
    return reply.send(await container.resolve('listSessions').execute());
  }
  async create(req: FastifyRequest<{ Body: CreateSessionInput }>, reply: FastifyReply) {
    const res = await container.resolve('createSession').execute(req.body);
    return reply.code(201).send(res);
  }
  async delete(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    await container.resolve('deleteSession').execute({ id: Number(req.params.id) });
    return reply.code(204).send();
  }
}
