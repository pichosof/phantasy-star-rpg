import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type {
  IFileStorage,
  ReadFileResult,
  SaveFileResult,
  SaveStreamOptions,
} from './file-storage.port.js';
import {
  buildPublicFileUrl,
  guessMimeFromKey,
  normalizeStorageKey,
  resolveLocalStoragePath,
  SizeLimitTransform,
} from './file-storage.utils.js';

export class LocalFileStorage implements IFileStorage {
  async saveStream(stream: Readable, opts: SaveStreamOptions): Promise<SaveFileResult> {
    const key = normalizeStorageKey(opts.key);
    const fullPath = resolveLocalStoragePath(key);
    await fsp.mkdir(path.dirname(fullPath), { recursive: true });

    const limiter = new SizeLimitTransform(opts.maxBytes);
    const writer = fs.createWriteStream(fullPath, { flags: 'wx' });

    try {
      await pipeline(stream, limiter, writer);
    } catch (error) {
      await fsp.rm(fullPath, { force: true });
      throw error;
    }

    return {
      url: this.publicUrl(key),
      key,
      mime: opts.mime,
      size: limiter.bytesWritten,
      filename: path.posix.basename(key),
    };
  }

  async saveBuffer(
    buffer: Buffer,
    opts: Omit<SaveStreamOptions, 'maxBytes'>,
  ): Promise<SaveFileResult> {
    const key = normalizeStorageKey(opts.key);
    const fullPath = resolveLocalStoragePath(key);
    await fsp.mkdir(path.dirname(fullPath), { recursive: true });
    await fsp.writeFile(fullPath, buffer, { flag: 'wx' });

    return {
      url: this.publicUrl(key),
      key,
      mime: opts.mime,
      size: buffer.length,
      filename: path.posix.basename(key),
    };
  }

  async openReadStream(
    key: string,
    range?: { start: number; end: number } | null,
  ): Promise<ReadFileResult | null> {
    const safeKey = normalizeStorageKey(key);
    const fullPath = resolveLocalStoragePath(safeKey);

    let stat: fs.Stats;
    try {
      stat = await fsp.stat(fullPath);
    } catch {
      return null;
    }

    const start = range?.start ?? 0;
    const end = range?.end ?? stat.size - 1;
    return {
      stream: fs.createReadStream(fullPath, { start, end }),
      mime: guessMimeFromKey(safeKey),
      totalSize: stat.size,
      contentLength: end - start + 1,
      range: range ?? undefined,
    };
  }

  async deleteByKey(key: string): Promise<void> {
    await fsp.rm(resolveLocalStoragePath(key), { force: true });
  }

  publicUrl(key: string): string {
    return buildPublicFileUrl(key);
  }
}
