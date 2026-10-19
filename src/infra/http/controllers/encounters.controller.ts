import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  createEncounterInput,
  saveEncounterInput,
} from '../../../core/use-cases/encounters/encounter-use-cases.js';
import { EncounterConflictError } from '../../../core/use-cases/encounters/errors.js';
import { container } from '../../../di/container.js';

type IdParams = { id: string };

const parseId = (req: FastifyRequest<{ Params: IdParams }>) => {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export class EncountersController {
  async list(_req: FastifyRequest, reply: FastifyReply) {
    return reply.send(await container.resolve('listEncounters').execute());
  }

  async get(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = parseId(req);
    if (!id) return reply.code(400).send({ error: 'Invalid id' });
    return reply.send(await container.resolve('getEncounter').execute(id));
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const parsed = createEncounterInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    return reply.code(201).send(await container.resolve('createEncounter').execute(parsed.data));
  }

  async save(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = parseId(req);
    if (!id) return reply.code(400).send({ error: 'Invalid id' });
    const parsed = saveEncounterInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    try {
      return reply.send(await container.resolve('saveEncounter').execute(id, parsed.data));
    } catch (e) {
      if (e instanceof EncounterConflictError) {
        return reply
          .code(409)
          .send({ error: 'Conflict', message: e.message, currentVersion: e.currentVersion });
      }
      throw e;
    }
  }

  async delete(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = parseId(req);
    if (!id) return reply.code(400).send({ error: 'Invalid id' });
    await container.resolve('deleteEncounter').execute(id);
    return reply.code(204).send();
  }
}
