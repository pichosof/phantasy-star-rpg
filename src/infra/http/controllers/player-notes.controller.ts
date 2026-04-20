import { eq, asc } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { db, schema } from '../../db/index.js';

type IdParams = { id: string; noteId: string };

export class PlayerNotesController {
  async list(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const playerId = Number(req.params.id);
    if (!Number.isFinite(playerId)) return reply.code(400).send({ error: 'Invalid id' });
    const notes = await db
      .select()
      .from(schema.playerNotes)
      .where(eq(schema.playerNotes.playerId, playerId))
      .orderBy(asc(schema.playerNotes.createdAt));
    return reply.code(200).send(notes);
  }

  async create(
    req: FastifyRequest<{
      Params: { id: string };
      Body: { title: string; content?: string; date: string };
    }>,
    reply: FastifyReply,
  ) {
    const playerId = Number(req.params.id);
    if (!Number.isFinite(playerId)) return reply.code(400).send({ error: 'Invalid id' });
    const { title, content, date } = req.body;
    if (!title?.trim()) return reply.code(400).send({ error: 'title required' });
    if (!date?.trim()) return reply.code(400).send({ error: 'date required' });
    const [note] = await db
      .insert(schema.playerNotes)
      .values({
        playerId,
        title: title.trim(),
        content: content?.trim() ?? null,
        date: date.trim(),
      })
      .returning();
    return reply.code(201).send(note);
  }

  async update(
    req: FastifyRequest<{
      Params: IdParams;
      Body: { title?: string; content?: string; date?: string };
    }>,
    reply: FastifyReply,
  ) {
    const noteId = Number(req.params.noteId);
    if (!Number.isFinite(noteId)) return reply.code(400).send({ error: 'Invalid noteId' });
    const { title, content, date } = req.body;
    await db
      .update(schema.playerNotes)
      .set({
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(content !== undefined ? { content: content.trim() || null } : {}),
        ...(date !== undefined ? { date: date.trim() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.playerNotes.id, noteId));
    return reply.code(204).send();
  }

  async delete(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const noteId = Number(req.params.noteId);
    if (!Number.isFinite(noteId)) return reply.code(400).send({ error: 'Invalid noteId' });
    await db.delete(schema.playerNotes).where(eq(schema.playerNotes.id, noteId));
    return reply.code(204).send();
  }
}
