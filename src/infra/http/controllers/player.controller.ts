// src/infra/http/controllers/player.controller.ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import { createPlayerInput } from '../../../core/use-cases/player/create-player';
import { container } from '../../../di/container';

type CreatePlayerBody = z.infer<typeof createPlayerInput>;

export class PlayerController {
  async list(_req: FastifyRequest, reply: FastifyReply) {
    const uc = container.resolve('listPlayers');
    const items = await uc.execute();
    return reply.code(200).send(items);
  }

  async create(req: FastifyRequest<{ Body: CreatePlayerBody }>, reply: FastifyReply) {
    const parsed = createPlayerInput.safeParse(req.body);
    if (!parsed.success) {
      throw parsed.error; // seu errorHandler de Zod cuida
    }
    const uc = container.resolve('createPlayer');
    const result = await uc.execute(parsed.data);
    return reply.code(201).send(result);
  }
}
