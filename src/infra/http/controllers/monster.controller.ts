import { randomUUID } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { CreateMonsterInput } from '../../../core/use-cases/bestiary/create-monster.js';
import type { UpdateMonsterInput } from '../../../core/use-cases/bestiary/update-monster.js';
import { container } from '../../../di/container.js';
import { deleteStoredFileByUrl, fileStorage } from '../../storage/index.js';

type IdParams = { id: string };

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
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const repo = container.resolve('monsterRepo');
    const current = await repo.findById(id);

    try {
      const saved = await fileStorage.saveStream(part.file, {
        key: `bestiary/images/${id}-${Date.now()}-${randomUUID()}.${ext}`,
        mime,
        maxBytes,
      });

      await container.resolve('updateMonsterImage').execute({
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

  async delete(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

    const repo = container.resolve('monsterRepo');
    const current = await repo.findById(id);
    await deleteStoredFileByUrl(current?.imageUrl);

    await container.resolve('deleteMonster').execute({ id });
    return reply.code(204).send();
  }
}
