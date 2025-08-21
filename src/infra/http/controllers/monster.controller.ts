import type { FastifyReply, FastifyRequest } from 'fastify';

import type { CreateMonsterInput } from '../../../core/use-cases/bestiary/create-monster.js';
import { container } from '../../../di/container.js';

export class MonsterController {
  async list(req: FastifyRequest, reply: FastifyReply) {
    return reply.send(await container.resolve('listMonsters').execute());
  }
  async create(req: FastifyRequest<{ Body: CreateMonsterInput }>, reply: FastifyReply) {
    const res = await container.resolve('createMonster').execute(req.body);
    return reply.code(201).send(res);
  }
  async setDiscovered(
    req: FastifyRequest<{ Params: { id: string }; Body: { discovered: boolean } }>,
    reply: FastifyReply,
  ) {
    await container
      .resolve('setMonsterDiscovered')
      .execute({ id: Number(req.params.id), discovered: req.body.discovered });
    return reply.code(204).send();
  }
  async setVisibility(
  req: FastifyRequest<{ Params: { id: string }; Body: { visible: boolean } }>,
  reply: FastifyReply
) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
  const { visible } = req.body;
  if (typeof visible !== 'boolean') return reply.code(400).send({ error: 'Invalid visible flag' });

  // Trocar a key pelo domínio correto:
  // players -> 'setPlayerVisibility', quests -> 'setQuestVisibility', etc.
  await container.resolve('setMonsterVisibility').execute(id, visible);
  return reply.code(204).send();
}
  async updateImage(
    req: FastifyRequest<{
      Params: { id: string };
      Body: { url: string; alt?: string; mime?: string; size?: number };
    }>,
    reply: FastifyReply,
  ) {
    await container
      .resolve('updateMonsterImage')
      .execute({ id: Number(req.params.id), ...req.body });
    return reply.code(204).send();
  }
  async delete(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    await container.resolve('deleteMonster').execute({ id: Number(req.params.id) });
    return reply.code(204).send();
  }
}
