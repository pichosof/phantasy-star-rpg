import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import type { CreateSessionInput } from '../../../core/use-cases/session/create-session';
import { updateSessionInput } from '../../../core/use-cases/session/update-session';
import { container } from '../../../di/container.js';

type UpdateBody = z.infer<typeof updateSessionInput>;

export class SessionController {
  async list(req: FastifyRequest, reply: FastifyReply) {
    return reply.send(await container.resolve('listSessions').execute());
  }

  async create(req: FastifyRequest<{ Body: CreateSessionInput }>, reply: FastifyReply) {
    const res = await container.resolve('createSession').execute(req.body);
    return reply.code(201).send(res);
  }

  // 👇 NOVO
  async update(
    req: FastifyRequest<{ Params: { id: string }; Body: UpdateBody }>,
    reply: FastifyReply,
  ) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

    const parsed = updateSessionInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;

    await container.resolve('updateSession').execute(id, parsed.data);
    return reply.code(204).send();
  }

  async delete(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    await container.resolve('deleteSession').execute({ id: Number(req.params.id) });
    return reply.code(204).send();
  }
}
