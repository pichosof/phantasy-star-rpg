import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import type { FastifyReply, FastifyRequest } from 'fastify';

import { createWikiPageInput } from '../../../core/use-cases/wiki/create-wiki-page.js';
import { updateWikiPageInput } from '../../../core/use-cases/wiki/update-wiki-page.js';
import { container } from '../../../di/container.js';

type IdParams = { id: string };

const IMG_DIR = path.resolve('data', 'uploads', 'wiki', 'images');
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export class WikiController {
  async list(_req: FastifyRequest, reply: FastifyReply) {
    const pages = await container.resolve('listWikiPages').execute();
    return reply.code(200).send(pages);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const parsed = createWikiPageInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    const page = await container.resolve('createWikiPage').execute(parsed.data);
    return reply.code(201).send(page);
  }

  async update(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    const parsed = updateWikiPageInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    await container.resolve('updateWikiPage').execute(id, parsed.data);
    return reply.code(204).send();
  }

  async setVisibility(
    req: FastifyRequest<{ Params: IdParams; Body: { visible: boolean } }>,
    reply: FastifyReply,
  ) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    await container.resolve('setWikiPageVisibility').execute(id, req.body.visible);
    return reply.code(204).send();
  }

  async delete(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    await container.resolve('deleteWikiPage').execute(id);
    return reply.code(204).send();
  }

  async uploadImage(req: FastifyRequest, reply: FastifyReply) {
    const part = await req.file();
    if (!part) return reply.code(400).send({ error: 'Missing file' });

    const mime = part.mimetype || 'application/octet-stream';
    if (!ALLOWED_MIME.includes(mime as (typeof ALLOWED_MIME)[number])) {
      return reply.code(400).send({ error: 'Unsupported file type' });
    }

    const maxBytes = (Number(process.env.MAX_UPLOAD_MB || 30) * 1024 * 1024) | 0;
    await fsp.mkdir(IMG_DIR, { recursive: true });

    const ext =
      mime === 'image/png'
        ? 'png'
        : mime === 'image/webp'
          ? 'webp'
          : mime === 'image/gif'
            ? 'gif'
            : 'jpg';
    const name = `${Date.now()}-${randomUUID()}.${ext}`;
    const filePath = path.join(IMG_DIR, name);

    let written = 0;
    const ws = fs.createWriteStream(filePath, { flags: 'wx' });
    part.file.on('data', (chunk: Buffer) => {
      written += chunk.length;
      if (written > maxBytes) part.file.destroy(new Error('File too large'));
    });

    try {
      await pipeline(part.file, ws);
    } catch (e) {
      await fsp.rm(filePath, { force: true });
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('too large')) return reply.code(413).send({ error: 'Payload too large' });
      throw e;
    }

    return reply.code(200).send({ url: `/files/wiki/images/${name}` });
  }
}
