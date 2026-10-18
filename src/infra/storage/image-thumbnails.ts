import sharp from 'sharp';

import type { IFileStorage } from './file-storage.port.js';
import { guessMimeFromKey, normalizeStorageKey } from './file-storage.utils.js';

/**
 * On-demand resized copies of uploaded images, cached in the same storage as the originals.
 *
 *   GET /files/<key>?w=640  →  _thumbs/w640/<key>.webp  (generated on first request)
 *
 * Works for every image already uploaded, with no change to the upload routes.
 * Animated GIFs become a still of their first frame; the original (with animation)
 * is still served without `?w`, e.g. for the zoom/lightbox.
 */

/** Only these widths are generated, so a client can't fill the storage with variants. */
export const THUMB_WIDTHS = [320, 640, 1280] as const;
export type ThumbWidth = (typeof THUMB_WIDTHS)[number];

const THUMB_PREFIX = '_thumbs';
const MAX_SOURCE_BYTES = 80 * 1024 * 1024; // the largest current upload is a ~28 MB GIF
const RESIZABLE = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export function parseThumbWidth(raw: unknown): ThumbWidth | null {
  const n = Number(raw);
  return (THUMB_WIDTHS as readonly number[]).includes(n) ? (n as ThumbWidth) : null;
}

export function thumbKey(key: string, width: ThumbWidth): string {
  return `${THUMB_PREFIX}/w${width}/${normalizeStorageKey(key)}.webp`;
}

export function isThumbKey(key: string): boolean {
  return normalizeStorageKey(key).startsWith(`${THUMB_PREFIX}/`);
}

async function readAll(stream: AsyncIterable<unknown>, limit: number): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += buf.length;
    if (size > limit) return null;
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

export class ImageThumbnails {
  /** Concurrent requests for the same variant share one resize. */
  private readonly inFlight = new Map<string, Promise<Buffer | null>>();

  constructor(private readonly storage: IFileStorage) {}

  /** Returns the resized WebP (from cache, or freshly generated), or null when not resizable. */
  get(key: string, width: ThumbWidth): Promise<Buffer | null> {
    const tKey = thumbKey(key, width);
    let job = this.inFlight.get(tKey);
    if (!job) {
      job = this.load(key, width, tKey).finally(() => this.inFlight.delete(tKey));
      this.inFlight.set(tKey, job);
    }
    return job;
  }

  private async load(key: string, width: ThumbWidth, tKey: string): Promise<Buffer | null> {
    if (isThumbKey(key)) return null;
    const mime = guessMimeFromKey(key);
    if (!mime || !RESIZABLE.has(mime)) return null;

    const cached = await this.storage.openReadStream(tKey);
    if (cached) return readAll(cached.stream, MAX_SOURCE_BYTES);

    const original = await this.storage.openReadStream(key);
    if (!original) return null;
    const source = await readAll(original.stream, MAX_SOURCE_BYTES);
    if (!source) return null;

    const out = await sharp(source, { animated: false, failOn: 'none' })
      .rotate() // honour EXIF orientation from phone photos
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();

    await this.storage.saveBuffer(out, { key: tKey, mime: 'image/webp' });
    return out;
  }

  /** Drops the cached variants of an original (call when the original is deleted). */
  async purge(key: string): Promise<void> {
    if (isThumbKey(key)) return;
    await Promise.all(
      THUMB_WIDTHS.map((w) => this.storage.deleteByKey(thumbKey(key, w)).catch(() => undefined)),
    );
  }
}
