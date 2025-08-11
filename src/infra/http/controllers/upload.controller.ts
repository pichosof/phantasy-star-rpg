import type { FastifyReply, FastifyRequest } from 'fastify';

import { LocalFileStorage } from '../../storage/local-file.storage.js';

const storage = new LocalFileStorage();

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

    const saved = await storage.save(buffer, { mime: data.mimetype });
    return reply.code(201).send({
      url: saved.url,
      mime: saved.mime,
      size: saved.size,
      filename: saved.filename,
    });
  }
}
