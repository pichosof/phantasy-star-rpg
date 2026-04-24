import { randomUUID } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import { createPlayerInput } from '../../../core/use-cases/player/create-player';
import { container } from '../../../di/container';
import { deleteStoredFileByUrl, fileStorage } from '../../storage/index.js';

type IdParams = { id: string };

type CreatePlayerBody = z.infer<typeof createPlayerInput>;

export class PlayerController {
  async list(_req: FastifyRequest, reply: FastifyReply) {
    const uc = container.resolve('listPlayers');
    const items = await uc.execute();
    return reply.code(200).send(items);
  }

  async create(req: FastifyRequest<{ Body: CreatePlayerBody }>, reply: FastifyReply) {
    const parsed = createPlayerInput.safeParse(req.body);
    if (!parsed.success) {
      throw parsed.error; // seu errorHandler de Zod cuida
    }
    const uc = container.resolve('createPlayer');
    const result = await uc.execute(parsed.data);
    return reply.code(201).send(result);
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
    await container.resolve('setPlayerVisibility').execute(id, visible);
    return reply.code(204).send();
  }
  async updateImage(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return reply.code(400).send({ error: 'Invalid id' });
    }

    const part = await req.file();
    if (!part) return reply.code(400).send({ error: 'Missing file "image"' });

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
    const mime = part.mimetype || 'application/octet-stream';
    if (!allowed.includes(mime as (typeof allowed)[number])) {
      return reply.code(400).send({ error: 'Unsupported file type' });
    }

    const maxBytes = (Number(process.env.MAX_UPLOAD_MB || 30) * 1024 * 1024) | 0;
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const repo = container.resolve('playerRepo');
    const [player] = await repo.findById(id);

    try {
      const saved = await fileStorage.saveStream(part.file, {
        key: `players/images/${id}-${Date.now()}-${randomUUID()}.${ext}`,
        mime,
        maxBytes,
      });

      await container.resolve('updatePlayerImage').execute(id, {
        url: saved.url,
        alt: (req.headers['x-image-alt'] as string) || null,
        mime,
        size: saved.size,
      });

      await deleteStoredFileByUrl(player?.imageUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('too large')) {
        return reply.code(413).send({ error: 'Payload too large' });
      }
      throw e;
    }

    return reply.code(204).send();
  }

  async updateSheet(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return reply.code(400).send({ error: 'Invalid id' });
    }

    const part = await req.file();
    if (!part) return reply.code(400).send({ error: 'Missing file "sheet"' });

    const mime = part.mimetype || 'application/octet-stream';
    if (mime !== 'application/pdf') {
      return reply.code(400).send({ error: 'Only PDF allowed' });
    }

    const maxBytes = (Number(process.env.MAX_UPLOAD_MB || 30) * 1024 * 1024) | 0;
    const repo = container.resolve('playerRepo');
    const [player] = await repo.findById(id);

    try {
      const saved = await fileStorage.saveStream(part.file, {
        key: `players/sheets/${id}-${Date.now()}-${randomUUID()}.pdf`,
        mime,
        maxBytes,
      });

      await container.resolve('updatePlayerSheet').execute(id, {
        url: saved.url,
        mime,
        size: saved.size,
      });

      await deleteStoredFileByUrl(player?.sheetUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('too large')) {
        return reply.code(413).send({ error: 'Payload too large' });
      }
      throw e;
    }

    return reply.code(204).send();
  }

  async delete(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

    const repo = container.resolve('playerRepo');
    const [player] = await repo.findById(id);

    if (player) {
      await deleteStoredFileByUrl(player.imageUrl);
      await deleteStoredFileByUrl(player.sheetUrl);
    }

    // Delete from DB (cascade removes player_notes, player_quests)
    await repo.delete(id);
    return reply.code(204).send();
  }
}
