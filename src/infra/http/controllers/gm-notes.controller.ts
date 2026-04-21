import type { FastifyReply, FastifyRequest } from 'fastify';

import { createGmNoteInput } from '../../../core/use-cases/gm-notes/create-gm-note.js';
import { updateGmNoteInput } from '../../../core/use-cases/gm-notes/update-gm-note.js';
import { container } from '../../../di/container.js';

type IdParams = { id: string };

export class GmNotesController {
  async list(req: FastifyRequest<{ Querystring: { tag?: string } }>, reply: FastifyReply) {
    const notes = await container.resolve('listGmNotes').execute(req.query.tag);
    return reply.send(notes);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const parsed = createGmNoteInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    const note = await container.resolve('createGmNote').execute(parsed.data);
    return reply.code(201).send(note);
  }

  async update(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    const parsed = updateGmNoteInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    await container.resolve('updateGmNote').execute(id, parsed.data);
    return reply.code(204).send();
  }

  async delete(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    await container.resolve('deleteGmNote').execute(id);
    return reply.code(204).send();
  }
}
