import { randomUUID } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';

import { container } from '../../../di/container.js';
import { fileStorage } from '../../storage/index.js';

type IdParams = { id: string };

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export class GmImagesController {
  async list(_req: FastifyRequest, reply: FastifyReply) {
    const images = await container.resolve('listGmImages').execute();
    return reply.send(images);
  }

  async upload(req: FastifyRequest, reply: FastifyReply) {
    const part = await req.file();
    if (!part) return reply.code(400).send({ error: 'Missing file' });

    const mime = part.mimetype || 'application/octet-stream';
    if (!ALLOWED_MIME.includes(mime as (typeof ALLOWED_MIME)[number])) {
      return reply.code(400).send({ error: 'Unsupported file type' });
    }

    const maxBytes = (Number(process.env.MAX_UPLOAD_MB || 30) * 1024 * 1024) | 0;
    const ext =
      mime === 'image/png'
        ? 'png'
        : mime === 'image/webp'
          ? 'webp'
          : mime === 'image/gif'
            ? 'gif'
            : 'jpg';
    const filename = `${Date.now()}-${randomUUID()}.${ext}`;

    try {
      const saved = await fileStorage.saveStream(part.file, {
        key: `gm/images/${filename}`,
        mime,
        maxBytes,
      });

      const alt = (req.headers['x-image-alt'] as string) || null;
      const img = await container
        .resolve('uploadGmImage')
        .execute({ filename, url: saved.url, alt, mime, size: saved.size });
      return reply.code(201).send(img);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('too large')) return reply.code(413).send({ error: 'Payload too large' });
      throw e;
    }
  }

  async delete(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    await container.resolve('deleteGmImage').execute(id);
    return reply.code(204).send();
  }
}
