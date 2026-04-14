import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { CreateMonsterInput } from '../../../core/use-cases/bestiary/create-monster.js';
import type { UpdateMonsterInput } from '../../../core/use-cases/bestiary/update-monster.js';
import { container } from '../../../di/container.js';

type IdParams = { id: string };

const IMG_DIR = path.resolve('data', 'uploads', 'bestiary', 'images');

export class MonsterController {
  async list(req: FastifyRequest, reply: FastifyReply) {
    return reply.send(await container.resolve('listMonsters').execute());
  }

  async create(req: FastifyRequest<{ Body: CreateMonsterInput }>, reply: FastifyReply) {
    const res = await container.resolve('createMonster').execute(req.body);
    return reply.code(201).send(res);
  }

  async update(
    req: FastifyRequest<{ Params: IdParams; Body: UpdateMonsterInput }>,
    reply: FastifyReply,
  ) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    await container.resolve('updateMonster').execute(id, req.body);
    return reply.code(204).send();
  }

  async setDiscovered(
    req: FastifyRequest<{ Params: IdParams; Body: { discovered: boolean } }>,
    reply: FastifyReply,
  ) {
    await container
      .resolve('setMonsterDiscovered')
      .execute({ id: Number(req.params.id), discovered: req.body.discovered });
    return reply.code(204).send();
  }

  async setVisibility(
    req: FastifyRequest<{ Params: IdParams; Body: { visible: boolean } }>,
    reply: FastifyReply,
  ) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    await container.resolve('setMonsterVisibility').execute(id, req.body.visible);
    return reply.code(204).send();
  }

  async updateImage(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

    const part = await req.file();
    if (!part) return reply.code(400).send({ error: 'Missing file "image"' });

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
    const mime = part.mimetype || 'application/octet-stream';
    if (!allowed.includes(mime as (typeof allowed)[number])) {
      return reply.code(400).send({ error: 'Unsupported file type' });
    }

    const maxBytes = (Number(process.env.MAX_UPLOAD_MB || 30) * 1024 * 1024) | 0;

    await fsp.mkdir(IMG_DIR, { recursive: true });
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const name = `${id}-${Date.now()}-${randomUUID()}.${ext}`;
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

    const publicUrl = `/files/bestiary/images/${name}`;
    await container.resolve('updateMonsterImage').execute({
      id,
      url: publicUrl,
      alt: (req.headers['x-image-alt'] as string) || null,
      mime,
      size: written,
    });

    return reply.code(204).send();
  }

  async delete(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    await container.resolve('deleteMonster').execute({ id: Number(req.params.id) });
    return reply.code(204).send();
  }
}
