import path from 'node:path';
import { Transform } from 'node:stream';

import { env } from '../config/env.js';

import type { ByteRange } from './file-storage.port.js';

const FILES_PREFIX = '/files/';

export class UnsafeStorageKeyError extends Error {
  readonly statusCode = 400;
  constructor() {
    super('Invalid storage key');
    this.name = 'UnsafeStorageKeyError';
  }
}

/** A key may never climb out of the storage root: no empty, `.` or `..` segments, no NUL. */
export function isSafeStorageKey(key: string): boolean {
  const k = key.replace(/\\/g, '/').replace(/^\/+/, '');
  return (
    k.length > 0 &&
    !k.includes('\0') &&
    k.split('/').every((s) => s !== '' && s !== '.' && s !== '..')
  );
}

export function normalizeStorageKey(key: string): string {
  if (!isSafeStorageKey(key)) throw new UnsafeStorageKeyError();
  return key.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function buildPublicFileUrl(key: string): string {
  return `${FILES_PREFIX}${encodeStorageKey(normalizeStorageKey(key))}`;
}

export function extractStorageKeyFromUrl(url: string): string | null {
  if (!url.startsWith(FILES_PREFIX)) return null;
  return decodeStorageKey(url.slice(FILES_PREFIX.length));
}

export function encodeStorageKey(key: string): string {
  return normalizeStorageKey(key)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/** Decodes a /files/ path into a storage key; null when it is malformed or climbs out of the root. */
export function decodeStorageKey(value: string): string | null {
  let key: string;
  try {
    key = value
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/');
  } catch (err) {
    if (err instanceof URIError) return null;
    throw err;
  }
  return isSafeStorageKey(key) ? normalizeStorageKey(key) : null;
}

export function resolveLocalStoragePath(key: string): string {
  const root = path.resolve(env.UPLOADS_LOCAL_DIR);
  const full = path.resolve(root, ...normalizeStorageKey(key).split('/'));
  if (!full.startsWith(root + path.sep)) throw new UnsafeStorageKeyError();
  return full;
}

export class SizeLimitTransform extends Transform {
  bytesWritten = 0;

  constructor(private readonly maxBytes?: number) {
    super();
  }

  override _transform(
    chunk: Buffer | string,
    _encoding: string,
    callback: (error?: Error | null, data?: Buffer) => void,
  ) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this.bytesWritten += buffer.length;
    if (this.maxBytes && this.bytesWritten > this.maxBytes) {
      callback(new Error('File too large'));
      return;
    }
    callback(null, buffer);
  }
}

export function guessMimeFromKey(key: string): string | null {
  switch (path.posix.extname(normalizeStorageKey(key)).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.pdf':
      return 'application/pdf';
    case '.txt':
      return 'text/plain; charset=utf-8';
    case '.md':
      return 'text/markdown; charset=utf-8';
    case '.doc':
      return 'application/msword';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.xls':
      return 'application/vnd.ms-excel';
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.ppt':
      return 'application/vnd.ms-powerpoint';
    case '.pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case '.zip':
      return 'application/zip';
    case '.epub':
      return 'application/epub+zip';
    case '.mobi':
      return 'application/x-mobipocket-ebook';
    default:
      return null;
  }
}

export function parseRangeHeader(header: string | undefined, totalSize: number): ByteRange | null {
  if (!header) return null;
  const match = /bytes=(\d*)-(\d*)/.exec(header);
  if (!match) return null;

  const rawStart = match[1];
  const rawEnd = match[2];

  let start = rawStart ? Number.parseInt(rawStart, 10) : NaN;
  let end = rawEnd ? Number.parseInt(rawEnd, 10) : NaN;

  if (!rawStart && rawEnd) {
    const suffixSize = Number.parseInt(rawEnd, 10);
    if (Number.isNaN(suffixSize) || suffixSize <= 0) return null;
    start = Math.max(totalSize - suffixSize, 0);
    end = totalSize - 1;
  } else {
    if (Number.isNaN(start) || start < 0) return null;
    end = Number.isNaN(end) ? totalSize - 1 : end;
  }

  if (Number.isNaN(end) || end < start || end >= totalSize) return null;
  return { start, end };
}
