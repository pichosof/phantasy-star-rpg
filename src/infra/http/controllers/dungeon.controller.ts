import { randomUUID } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';

import { container } from '../../../di/container.js';
import { deleteStoredFileByUrl, fileStorage } from '../../storage/index.js';

type IdParams = { id: string };

export class DungeonController {
  async list(_req: FastifyRequest, reply: FastifyReply) {
    const repo = container.resolve('dungeonRepo');
    const items = await repo.list();
    return reply.send(items);
  }

  async create(
    req: FastifyRequest<{
      Body: {
        name: string;
        type?: string | null;
        description?: string | null;
        region?: string | null;
        coordinates?: string | null;
        cityId?: number | null;
        worldId?: number | null;
      };
    }>,
    reply: FastifyReply,
  ) {
    const repo = container.resolve('dungeonRepo');
    const row = await repo.create(req.body);
    return reply.code(201).send(row);
  }

  async update(
    req: FastifyRequest<{
      Params: IdParams;
      Body: {
        name?: string;
        type?: string | null;
        description?: string | null;
        region?: string | null;
        coordinates?: string | null;
        discovered?: boolean;
        cityId?: number | null;
        worldId?: number | null;
      };
    }>,
    reply: FastifyReply,
  ) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    const repo = container.resolve('dungeonRepo');
    await repo.update(id, req.body);
    return reply.code(204).send();
  }

  async setVisibility(
    req: FastifyRequest<{ Params: IdParams; Body: { visible: boolean } }>,
    reply: FastifyReply,
  ) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    const repo = container.resolve('dungeonRepo');
    await repo.setVisibility(id, req.body.visible);
    return reply.code(204).send();
  }

  async setDiscovered(
    req: FastifyRequest<{ Params: IdParams; Body: { discovered: boolean } }>,
    reply: FastifyReply,
  ) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    const repo = container.resolve('dungeonRepo');
    await repo.setDiscovered(id, req.body.discovered);
    return reply.code(204).send();
  }

  async delete(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    const repo = container.resolve('dungeonRepo');

    // Delete image files from disk
    const dungeon = await repo.findById(id);
    if (dungeon) {
      for (const img of dungeon.images) {
        await deleteStoredFileByUrl(img.url);
      }
    }

    await repo.delete(id);
    return reply.code(204).send();
  }

  async addImage(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

    const part = await req.file();
    if (!part) return reply.code(400).send({ error: 'Missing file' });

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
    const mime = part.mimetype || 'application/octet-stream';
    if (!allowed.includes(mime as (typeof allowed)[number]))
      return reply.code(400).send({ error: 'Unsupported file type' });

    const maxBytes = (Number(process.env.MAX_UPLOAD_MB || 30) * 1024 * 1024) | 0;
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';

    try {
      const saved = await fileStorage.saveStream(part.file, {
        key: `dungeons/images/${id}-${Date.now()}-${randomUUID()}.${ext}`,
        mime,
        maxBytes,
      });

      const alt = (req.headers['x-image-alt'] as string) || null;
      const repo = container.resolve('dungeonRepo');
      const image = await repo.addImage({
        dungeonId: id,
        url: saved.url,
        alt,
        mime,
        size: saved.size,
      });
      return reply.code(201).send(image);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('too large')) return reply.code(413).send({ error: 'Payload too large' });
      throw e;
    }
  }

  async deleteImage(
    req: FastifyRequest<{ Params: { id: string; imageId: string } }>,
    reply: FastifyReply,
  ) {
    const imageId = Number(req.params.imageId);
    if (!Number.isFinite(imageId)) return reply.code(400).send({ error: 'Invalid imageId' });

    const repo = container.resolve('dungeonRepo');
    const deleted = await repo.deleteImage(imageId);
    if (deleted) {
      await deleteStoredFileByUrl(deleted.url);
    }
    return reply.code(204).send();
  }
}
