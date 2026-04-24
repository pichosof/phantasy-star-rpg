import { randomUUID } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import type { CreateNpcInput } from '../../../core/use-cases/npc/create-npc.js';
import { updateNpcInput } from '../../../core/use-cases/npc/update-npc.js';
import { container } from '../../../di/container.js';
import { deleteStoredFileByUrl, fileStorage } from '../../storage/index.js';

type IdParams = { id: string };
type UpdateBody = z.infer<typeof updateNpcInput>;

export class NpcController {
  async list(_req: FastifyRequest, reply: FastifyReply) {
    const items = await container.resolve('listNpcs').execute();
    return reply.send(items);
  }

  async create(req: FastifyRequest<{ Body: CreateNpcInput }>, reply: FastifyReply) {
    const res = await container.resolve('createNpc').execute(req.body);
    return reply.code(201).send(res);
  }

  async update(req: FastifyRequest<{ Params: IdParams; Body: UpdateBody }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    const parsed = updateNpcInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    await container.resolve('updateNpc').execute(id, parsed.data);
    return reply.code(204).send();
  }

  async setVisibility(
    req: FastifyRequest<{ Params: IdParams; Body: { visible: boolean } }>,
    reply: FastifyReply,
  ) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    await container.resolve('setNpcVisibility').execute(id, req.body.visible);
    return reply.code(204).send();
  }

  async updateImage(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

    const part = await req.file();
    if (!part) return reply.code(400).send({ error: 'Missing file' });

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
    const mime = part.mimetype || 'application/octet-stream';
    if (!allowed.includes(mime as (typeof allowed)[number])) {
      return reply.code(400).send({ error: 'Unsupported file type' });
    }

    const maxBytes = (Number(process.env.MAX_UPLOAD_MB || 30) * 1024 * 1024) | 0;
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const repo = container.resolve('npcRepo');
    const current = await repo.findById(id);

    try {
      const saved = await fileStorage.saveStream(part.file, {
        key: `npcs/images/${id}-${Date.now()}-${randomUUID()}.${ext}`,
        mime,
        maxBytes,
      });

      await container.resolve('updateNpcImage').execute({
        id,
        url: saved.url,
        alt: (req.headers['x-image-alt'] as string) || null,
        mime,
        size: saved.size,
      });

      await deleteStoredFileByUrl(current?.imageUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('too large')) return reply.code(413).send({ error: 'Payload too large' });
      throw e;
    }

    return reply.code(204).send();
  }

  async updateSheet(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

    const part = await req.file();
    if (!part) return reply.code(400).send({ error: 'Missing file' });

    const mime = part.mimetype || 'application/octet-stream';
    if (mime !== 'application/pdf') return reply.code(400).send({ error: 'Only PDF allowed' });

    const maxBytes = (Number(process.env.MAX_UPLOAD_MB || 30) * 1024 * 1024) | 0;
    const repo = container.resolve('npcRepo');
    const current = await repo.findById(id);

    try {
      const saved = await fileStorage.saveStream(part.file, {
        key: `npcs/sheets/${id}-${Date.now()}-${randomUUID()}.pdf`,
        mime,
        maxBytes,
      });

      const { db, schema } = await import('../../db/index.js');
      const { eq } = await import('drizzle-orm');
      await db
        .update(schema.npcs)
        .set({ sheetUrl: saved.url, sheetMime: mime, sheetSize: saved.size })
        .where(eq(schema.npcs.id, id));

      await deleteStoredFileByUrl(current?.sheetUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('too large')) return reply.code(413).send({ error: 'Payload too large' });
      throw e;
    }
    return reply.code(204).send();
  }

  async delete(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

    const repo = container.resolve('npcRepo');
    const current = await repo.findById(id);
    await deleteStoredFileByUrl(current?.imageUrl);
    await deleteStoredFileByUrl(current?.sheetUrl);

    await container.resolve('deleteNpc').execute({ id });
    return reply.code(204).send();
  }
}
