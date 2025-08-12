import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import { updatePlayerInput } from '../../../core/use-cases/player/update-player';
import { container } from '../../../di/container';

type Params = { playerId: string; questId: string };
type StatusBody = { status: 'assigned' | 'completed' | 'failed' };

type UpdateBody = z.infer<typeof updatePlayerInput>;
type IdParams = { id: string };

export class PlayerQuestController {
  async assign(req: FastifyRequest<{ Params: Params }>, reply: FastifyReply) {
    const p = Number(req.params.playerId);
    const q = Number(req.params.questId);
    if (!Number.isFinite(p) || !Number.isFinite(q)) {
      return reply.code(400).send({ error: 'Invalid ids' });
    }
    await container.resolve('assignQuestToPlayer').execute(p, q);
    return reply.code(204).send();
  }

  async setStatus(req: FastifyRequest<{ Params: Params; Body: StatusBody }>, reply: FastifyReply) {
    const p = Number(req.params.playerId);
    const q = Number(req.params.questId);
    const { status } = req.body;

    if (!Number.isFinite(p) || !Number.isFinite(q)) {
      return reply.code(400).send({ error: 'Invalid ids' });
    }
    await container.resolve('setPlayerQuestStatus').execute(p, q, status);
    return reply.code(204).send();
  }

  async update(req: FastifyRequest<{ Params: IdParams; Body: UpdateBody }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

    const parsed = updatePlayerInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;

    await container.resolve('updatePlayer').execute(id, parsed.data);
    return reply.code(204).send();
  }
}
