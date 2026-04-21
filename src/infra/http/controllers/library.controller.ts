import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

import type { FastifyReply, FastifyRequest } from 'fastify';

import { LibraryDocument } from '../../../core/entities/library-document.js';
import { container } from '../../../di/container.js';
import { hashKey, validateKeyStrength } from '../../security/key-hash.js';

type IdParams = { id: string };

const DOC_DIR = path.resolve('data', 'uploads', 'library');

/** Allowed MIME types and their canonical extensions. */
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
  'application/x-mobipocket-ebook': '.mobi',
  'application/mobi': '.mobi',
  'text/markdown': '.md',
};

/**
 * Converts a MOBI file to EPUB using Calibre's ebook-convert CLI.
 * Returns the new EPUB path on success, null if Calibre is not installed or conversion fails.
 * The original MOBI file is deleted on success.
 */
async function mobiToEpub(mobiPath: string): Promise<string | null> {
  const epubPath = mobiPath.replace(/\.mobi$/i, '.epub');
  try {
    await execFileAsync('ebook-convert', [mobiPath, epubPath]);
    await fsp.rm(mobiPath, { force: true });
    return epubPath;
  } catch {
    await fsp.rm(epubPath, { force: true }); // clean up partial output if any
    return null;
  }
}

/** Strip characters outside printable ASCII 0x20–0x7E for header values. */
function sanitiseHeader(value: string | undefined, maxLen = 500): string {
  if (!value) return '';
  return value
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .slice(0, maxLen);
}

/** Encode a filename for use in Content-Disposition (RFC 6266). */
function contentDispositionFilename(name: string): string {
  // ASCII-safe fallback + UTF-8 encoded version
  const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  const utf8 = encodeURIComponent(name).replace(/'/g, '%27');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

/** Parse a Range header — returns null when absent or unparseable. */
function parseRange(
  header: string | undefined,
  totalSize: number,
): { start: number; end: number } | null {
  if (!header) return null;
  const match = /bytes=(\d*)-(\d*)/.exec(header);
  if (!match) return null;
  const start = match[1] ? parseInt(match[1], 10) : totalSize - parseInt(match[2] ?? '0', 10);
  const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
  if (isNaN(start) || isNaN(end) || start > end || end >= totalSize) return null;
  return { start, end };
}

export class LibraryController {
  async list(_req: FastifyRequest, reply: FastifyReply) {
    const repo = container.resolve('libraryDocumentRepo');
    const docs = await repo.list();
    return reply.send(docs.map((d) => d.toJSON()));
  }

  async upload(req: FastifyRequest, reply: FastifyReply) {
    const part = await req.file();
    if (!part) return reply.code(400).send({ error: 'Missing file' });

    let mime = part.mimetype || 'application/octet-stream';

    // Browsers often report generic types for uncommon formats (e.g. MOBI → octet-stream).
    // Fall back to extension-based detection so the allow-list still applies.
    if (!ALLOWED_MIME[mime]) {
      const originalExt = path.extname(part.filename ?? '').toLowerCase();
      const EXT_TO_MIME: Record<string, string> = {
        '.mobi': 'application/x-mobipocket-ebook',
        '.epub': 'application/epub+zip',
        '.md': 'text/markdown',
      };
      if (EXT_TO_MIME[originalExt]) mime = EXT_TO_MIME[originalExt];
    }

    const ext = ALLOWED_MIME[mime];
    if (!ext) {
      return reply.code(400).send({ error: `Unsupported file type: ${mime}` });
    }

    const maxBytes = (Number(process.env.MAX_UPLOAD_MB || 30) * 1024 * 1024) | 0;
    await fsp.mkdir(DOC_DIR, { recursive: true });

    const filename = `${Date.now()}-${randomUUID()}${ext}`;
    const filePath = path.join(DOC_DIR, filename);

    const originalName =
      sanitiseHeader(part.filename || filename, 255).replace(/[/\\]/g, '_') || filename;

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
      if (msg.includes('too large'))
        return reply
          .code(413)
          .send({ error: `File exceeds the ${process.env.MAX_UPLOAD_MB || 30} MB limit.` });
      throw e;
    }

    // Convert MOBI → EPUB automatically so the viewer can render it.
    let storedFilename = filename;
    let storedMime = mime;
    if (mime === 'application/x-mobipocket-ebook' || mime === 'application/mobi') {
      const epubPath = await mobiToEpub(filePath);
      if (epubPath) {
        storedFilename = path.basename(epubPath);
        storedMime = 'application/epub+zip';
        const epubStat = await fsp.stat(epubPath).catch(() => null);
        if (epubStat) written = epubStat.size;
      }
      // If conversion failed (Calibre not installed) we keep the MOBI as-is.
    }

    const title =
      sanitiseHeader(req.headers['x-doc-title'] as string, 200) ||
      originalName.replace(/\.[^.]+$/, '');
    const description = sanitiseHeader(req.headers['x-doc-description'] as string, 2000) || null;
    const category = sanitiseHeader(req.headers['x-doc-category'] as string, 100) || null;
    const url = `/files/library/${storedFilename}`;

    const repo = container.resolve('libraryDocumentRepo');
    const doc = await repo.create(
      LibraryDocument.create({
        title,
        description,
        category,
        filename: storedFilename,
        originalName,
        url,
        mime: storedMime,
        size: written,
      }),
    );
    return reply.code(201).send(doc.toJSON());
  }

  /**
   * Streaming download with Range support.
   *
   * Serves the file with the original filename in Content-Disposition so the
   * browser uses the human-readable name instead of the UUID storage name.
   * Supports HTTP Range requests for resumable / partial downloads.
   */
  async download(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

    const repo = container.resolve('libraryDocumentRepo');
    const doc = await repo.findById(id);
    if (!doc) return reply.code(404).send({ error: 'Not found' });

    const filePath = path.join(DOC_DIR, doc.props.filename);

    let stat: Awaited<ReturnType<typeof fsp.stat>>;
    try {
      stat = await fsp.stat(filePath);
    } catch {
      return reply.code(404).send({ error: 'File not found on disk' });
    }

    const totalSize = stat.size;
    const range = parseRange(req.headers.range, totalSize);

    reply
      .header('Accept-Ranges', 'bytes')
      .header('Content-Type', doc.props.mime)
      .header('Content-Disposition', contentDispositionFilename(doc.props.originalName))
      // Prevent caching of large files in the browser — downloads should always be fresh
      .header('Cache-Control', 'no-store');

    if (range) {
      const { start, end } = range;
      const chunkSize = end - start + 1;
      reply
        .code(206)
        .header('Content-Range', `bytes ${start}-${end}/${totalSize}`)
        .header('Content-Length', String(chunkSize));
      return reply.send(fs.createReadStream(filePath, { start, end }));
    }

    reply.header('Content-Length', String(totalSize));
    return reply.send(fs.createReadStream(filePath));
  }

  async update(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

    const body = req.body as {
      title?: string;
      description?: string | null;
      category?: string | null;
      visible?: boolean;
    };

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

    const filePath = path.join(DOC_DIR, doc.props.filename);
    await fsp.rm(filePath, { force: true });

    await repo.delete(id);
    return reply.code(204).send();
  }

  async getSettings(_req: FastifyRequest, reply: FastifyReply) {
    const repo = container.resolve('libraryDocumentRepo');
    const stored = await repo.getPlayerKey();
    return reply.send({ hasPlayerKey: Boolean(stored?.startsWith('$scrypt$')) });
  }

  async setSettings(req: FastifyRequest, reply: FastifyReply) {
    const { playerKey } = req.body as { playerKey: string | null };
    const repo = container.resolve('libraryDocumentRepo');

    if (playerKey === null) {
      await repo.setPlayerKey(null);
      return reply.code(204).send();
    }

    const plain = playerKey.trim();
    const error = validateKeyStrength(plain);
    if (error) return reply.code(400).send({ error });

    const hashed = hashKey(plain);
    await repo.setPlayerKey(hashed);
    return reply.code(204).send();
  }
}
