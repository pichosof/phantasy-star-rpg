import { randomUUID } from 'node:crypto';

import type { MultipartFile } from '@fastify/multipart';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import { createWorldInput } from '../../../core/use-cases/world/create-world';
import { updateWorldInput } from '../../../core/use-cases/world/update-world';
import { container } from '../../../di/container';
import { deleteStoredFileByUrl, fileStorage } from '../../storage/index.js';

type CreateWorldBody = z.infer<typeof createWorldInput>;
type IdParams = { id: string };
type UpdateBody = z.infer<typeof updateWorldInput>;

export class WorldController {
  async list(_req: FastifyRequest, reply: FastifyReply) {
    const uc = container.resolve('listWorlds');
    const items = await uc.execute();
    return reply.code(200).send(items);
  }

  async create(req: FastifyRequest<{ Body: CreateWorldBody }>, reply: FastifyReply) {
    const parsed = createWorldInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    const uc = container.resolve('createWorld');
    const world = await uc.execute(parsed.data);
    return reply.code(201).send(world);
  }

  async updateImage(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

    const part: MultipartFile | undefined = await req.file();
    if (!part) return reply.code(400).send({ error: 'Missing file "image"' });

    const allowed = ['image/png', 'image/jpeg', 'image/webp'] as const;
    const mime = part.mimetype || 'application/octet-stream';
    if (!allowed.includes(mime as (typeof allowed)[number])) {
      return reply.code(400).send({ error: 'Unsupported file type' });
    }

    const maxBytes = (Number(process.env.MAX_UPLOAD_MB || 30) * 1024 * 1024) | 0;
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const repo = container.resolve('worldRepo');
    const current = await repo.findById(id);

    try {
      const saved = await fileStorage.saveStream(part.file, {
        key: `worlds/${id}-${Date.now()}-${randomUUID()}.${ext}`,
        mime,
        maxBytes,
      });

      await container.resolve('updateWorldImage').execute(id, {
        url: saved.url,
        alt: (req.headers['x-image-alt'] as string) || null,
        mime,
        size: saved.size,
      });

      await deleteStoredFileByUrl(current?.imageUrl);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('too large')) {
        return reply.code(413).send({ error: 'Payload too large' });
      }
      throw e;
    }

    return reply.code(204).send();
  }
  async setVisibility(
    req: FastifyRequest<{ Params: { id: string }; Body: { visible: boolean } }>,
    reply: FastifyReply,
  ) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    const { visible } = req.body;
    if (typeof visible !== 'boolean')
      return reply.code(400).send({ error: 'Invalid visible flag' });

    // Trocar a key pelo domínio correto:
    // players -> 'setPlayerVisibility', quests -> 'setQuestVisibility', etc.
    await container.resolve('setWorldVisibility').execute(id, visible);
    return reply.code(204).send();
  }
  async update(req: FastifyRequest<{ Params: IdParams; Body: UpdateBody }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    const parsed = updateWorldInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    await container.resolve('updateWorld').execute(id, parsed.data);
    return reply.code(204).send();
  }
}
