import type { FastifyReply, FastifyRequest } from 'fastify';

import { createSheetInput } from '../../../core/use-cases/character-sheets/create-character-sheet.js';
import { updateSheetInput } from '../../../core/use-cases/character-sheets/update-character-sheet.js';
import { container } from '../../../di/container.js';

type IdParams = { id: string };

export class CharacterSheetsController {
  async list(req: FastifyRequest<{ Querystring: { type?: string } }>, reply: FastifyReply) {
    const sheets = await container.resolve('listCharacterSheets').execute(req.query.type);
    return reply.send(sheets);
  }

  async get(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    const sheet = await container.resolve('getCharacterSheet').execute(id);
    if (!sheet) return reply.code(404).send({ error: 'Not found' });
    return reply.send(sheet);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const parsed = createSheetInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    const sheet = await container.resolve('createCharacterSheet').execute(parsed.data);
    return reply.code(201).send(sheet);
  }

  async update(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    const parsed = updateSheetInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    await container.resolve('updateCharacterSheet').execute(id, parsed.data);
    return reply.code(204).send();
  }

  async delete(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    await container.resolve('deleteCharacterSheet').execute(id);
    return reply.code(204).send();
  }
}
