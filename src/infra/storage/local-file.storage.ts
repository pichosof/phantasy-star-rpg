import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { IFileStorage, SaveFileResult } from './file-storage.port.js';

const UPLOAD_DIR = path.resolve('data', 'uploads');
const PUBLIC_PREFIX = '/files/';

export class LocalFileStorage implements IFileStorage {
  async save(buffer: Buffer, opts: { mime: string; ext?: string }): Promise<SaveFileResult> {
    const safeExt = opts.ext && opts.ext.startsWith('.') ? opts.ext : this.extFromMime(opts.mime);
    const filename = `${randomUUID()}${safeExt}`;
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const fullPath = path.join(UPLOAD_DIR, filename);
    await fs.writeFile(fullPath, buffer);
    return {
      url: `${PUBLIC_PREFIX}${filename}`,
      path: fullPath,
      mime: opts.mime,
      size: buffer.length,
      filename,
    };
  }

  private extFromMime(mime: string) {
    switch (mime) {
      case 'image/png':
        return '.png';
      case 'image/jpeg':
        return '.jpg';
      case 'image/webp':
        return '.webp';
      case 'image/gif':
        return '.gif';
      default:
        return '';
    }
  }
}
