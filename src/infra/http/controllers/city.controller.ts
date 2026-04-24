import { randomUUID } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import { createCityInput } from '../../../core/use-cases/cities/create-city';
import { setCityDiscoveredInput } from '../../../core/use-cases/cities/set-city-discovered';
import { updateCityInput } from '../../../core/use-cases/cities/update-city';
import { container } from '../../../di/container';
import { deleteStoredFileByUrl, fileStorage } from '../../storage/index.js';

type IdParams = { id: string };
type CreateBody = z.infer<typeof createCityInput>;
type UpdateBody = z.infer<typeof updateCityInput>;
type DiscoverBody = z.infer<typeof setCityDiscoveredInput>;

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
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const repo = container.resolve('cityRepo');
    const current = await repo.findById(id);

    try {
      const saved = await fileStorage.saveStream(part.file, {
        key: `cities/images/${id}-${Date.now()}-${randomUUID()}.${ext}`,
        mime,
        maxBytes,
      });

      await container.resolve('updateCityImage').execute(id, {
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
        key: `cities/images/${id}-${Date.now()}-${randomUUID()}.${ext}`,
        mime,
        maxBytes,
      });

      const alt = (req.headers['x-image-alt'] as string) || null;
      const repo = container.resolve('cityRepo');
      const image = await repo.addImage({
        cityId: id,
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
    const cityId = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    if (!Number.isFinite(cityId) || !Number.isFinite(imageId))
      return reply.code(400).send({ error: 'Invalid id' });

    const repo = container.resolve('cityRepo');
    const image = await repo.getImage(imageId);
    if (!image || image.cityId !== cityId) return reply.code(404).send({ error: 'Not found' });

    await deleteStoredFileByUrl(image.url);
    await repo.deleteImage(imageId);
    return reply.code(204).send();
  }

  async delete(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    const repo = container.resolve('cityRepo');
    const city = await repo.findById(id);
    if (city) {
      await deleteStoredFileByUrl(city.imageUrl);
      for (const image of city.images) {
        await deleteStoredFileByUrl(image.url);
      }
    }
    await container.resolve('deleteCity').execute({ id });
    return reply.code(204).send();
  }
}
