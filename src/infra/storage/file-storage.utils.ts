import path from 'node:path';
import { Transform } from 'node:stream';

import { env } from '../config/env.js';

import type { ByteRange } from './file-storage.port.js';

const FILES_PREFIX = '/files/';

export function normalizeStorageKey(key: string): string {
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

export function decodeStorageKey(value: string): string {
  return value
    .split('/')
    .map((segment) => decodeURIComponent(segment))
    .join('/');
}

export function resolveLocalStoragePath(key: string): string {
  return path.resolve(env.UPLOADS_LOCAL_DIR, ...normalizeStorageKey(key).split('/'));
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
