import type { Readable } from 'node:stream';

export interface ByteRange {
  start: number;
  end: number;
}

export interface SaveFileResult {
  url: string;
  key: string;
  mime: string;
  size: number;
  filename: string;
}

export interface SaveStreamOptions {
  key: string;
  mime: string;
  maxBytes?: number;
}

export interface ReadFileResult {
  stream: Readable;
  mime: string | null;
  totalSize: number;
  contentLength: number;
  range?: ByteRange;
}

export interface IFileStorage {
  saveStream(stream: Readable, opts: SaveStreamOptions): Promise<SaveFileResult>;
  saveBuffer(buffer: Buffer, opts: Omit<SaveStreamOptions, 'maxBytes'>): Promise<SaveFileResult>;
  openReadStream(key: string, range?: ByteRange | null): Promise<ReadFileResult | null>;
  deleteByKey(key: string): Promise<void>;
  publicUrl(key: string): string;
}
