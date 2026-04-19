import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import type { FastifyReply, FastifyRequest } from 'fastify';
import { container } from '../../../di/container.js';
import { LibraryDocument } from '../../../core/entities/library-document.js';

type IdParams = { id: string };

const DOC_DIR = path.resolve('data', 'uploads', 'library');

const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
  'application/epub+zip': '.epub',
  'text/markdown': '.md',
};

export class LibraryController {
  async list(req: FastifyRequest, reply: FastifyReply) {
    const repo = container.resolve('libraryDocumentRepo');
    const docs = await repo.list();
    return reply.send(docs.map((d) => d.toJSON()));
  }

  async upload(req: FastifyRequest, reply: FastifyReply) {
    const part = await req.file();
    if (!part) return reply.code(400).send({ error: 'Missing file' });

    const mime = part.mimetype || 'application/octet-stream';
    const ext = ALLOWED_MIME[mime];
    if (!ext) {
      return reply.code(400).send({ error: `Unsupported file type: ${mime}` });
    }

    const maxBytes = (Number(process.env.MAX_UPLOAD_MB || 30) * 1024 * 1024) | 0;
    await fsp.mkdir(DOC_DIR, { recursive: true });

    const filename = `${Date.now()}-${randomUUID()}${ext}`;
    const filePath = path.join(DOC_DIR, filename);
    const originalName = part.filename || filename;

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
      if (msg.includes('too large')) return reply.code(413).send({ error: 'File too large' });
      throw e;
    }

    const title = (req.headers['x-doc-title'] as string) || originalName.replace(/\.[^.]+$/, '');
    const description = (req.headers['x-doc-description'] as string) || null;
    const category = (req.headers['x-doc-category'] as string) || null;
    const url = `/files/library/${filename}`;

    const repo = container.resolve('libraryDocumentRepo');
    const doc = await repo.create(
      LibraryDocument.create({ title, description, category, filename, originalName, url, mime, size: written }),
    );
    return reply.code(201).send(doc.toJSON());
  }

  async update(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
    const body = req.body as { title?: string; description?: string | null; category?: string | null; visible?: boolean };
    const repo = container.resolve('libraryDocumentRepo');
    await repo.update(id, body);
    return reply.code(204).send();
  }

  async delete(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

    const repo = container.resolve('libraryDocumentRepo');
    const doc = await repo.findById(id);
    if (!doc) return reply.code(404).send({ error: 'Not found' });

    // Remove file from disk
    const filePath = path.join(DOC_DIR, doc.props.filename);
    await fsp.rm(filePath, { force: true });

    await repo.delete(id);
    return reply.code(204).send();
  }

  async getSettings(_req: FastifyRequest, reply: FastifyReply) {
    const repo = container.resolve('libraryDocumentRepo');
    const playerKey = await repo.getPlayerKey();
    return reply.send({ playerKey });
  }

  async setSettings(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as { playerKey: string | null };
    const repo = container.resolve('libraryDocumentRepo');
    await repo.setPlayerKey(body.playerKey?.trim() || null);
    return reply.code(204).send();
  }
}
