import { randomUUID } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';

import { fileStorage } from '../../storage/index.js';

function imageExtFromMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '.jpg';
  }
}

export class UploadController {
  async uploadImage(req: FastifyRequest, reply: FastifyReply) {
    const data = await req.file(); // campo padrão "file"
    if (!data) return reply.code(400).send({ error: 'No file' });
    if (!data.mimetype?.startsWith('image/')) {
      return reply.code(400).send({ error: 'Only image files are allowed' });
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk as Buffer);
    const buffer = Buffer.concat(chunks);

    const saved = await fileStorage.saveBuffer(buffer, {
      key: `misc/images/${randomUUID()}${imageExtFromMime(data.mimetype)}`,
      mime: data.mimetype,
    });
    return reply.code(201).send({
      url: saved.url,
      mime: saved.mime,
      size: saved.size,
      filename: saved.filename,
    });
  }
}
