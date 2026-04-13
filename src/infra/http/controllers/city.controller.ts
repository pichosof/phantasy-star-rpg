import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import { createCityInput } from '../../../core/use-cases/cities/create-city';
import { setCityDiscoveredInput } from '../../../core/use-cases/cities/set-city-discovered';
import { updateCityInput } from '../../../core/use-cases/cities/update-city';
import { container } from '../../../di/container';

type IdParams = { id: string };
type CreateBody = z.infer<typeof createCityInput>;
type UpdateBody = z.infer<typeof updateCityInput>;
type DiscoverBody = z.infer<typeof setCityDiscoveredInput>;

const IMG_DIR = path.resolve('data', 'uploads', 'cities', 'images');

export class CityController {
  async list(_req: FastifyRequest, reply: FastifyReply) {
    const uc = container.resolve('listCities');
    const items = await uc.execute();
    return reply.code(200).send(items);
  }

  async create(req: FastifyRequest<{ Body: CreateBody }>, reply: FastifyReply) {
    const parsed = createCityInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    const uc = container.resolve('createCity');
    const city = await uc.execute(parsed.data);
    return reply.code(201).send(city);
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
    await container.resolve('setCityVisibility').execute(id, visible);
    return reply.code(204).send();
  }

  async setDiscovered(
    req: FastifyRequest<{ Params: IdParams; Body: DiscoverBody }>,
    reply: FastifyReply,
  ) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    const parsed = setCityDiscoveredInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    await container
      .resolve('setCityDiscovered')
      .execute({ id, discovered: parsed.data.discovered });
    return reply.code(204).send();
  }

  async update(req: FastifyRequest<{ Params: IdParams; Body: UpdateBody }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    const parsed = updateCityInput.safeParse(req.body);
    if (!parsed.success) throw parsed.error;
    await container.resolve('updateCity').execute(id, parsed.data);
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

    const publicUrl = `/files/cities/images/${name}`;
    await container.resolve('updateCityImage').execute(id, {
      url: publicUrl,
      alt: (req.headers['x-image-alt'] as string) || null,
      mime,
      size: written,
    });

    return reply.code(204).send();
  }

  async delete(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    await container.resolve('deleteCity').execute({ id });
    return reply.code(204).send();
  }
}
