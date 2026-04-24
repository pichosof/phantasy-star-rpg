import type { Readable } from 'node:stream';

import { BlobServiceClient } from '@azure/storage-blob';

import { env } from '../config/env.js';

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
  SizeLimitTransform,
} from './file-storage.utils.js';

type AccessTier = 'Hot' | 'Cool' | 'Cold' | 'Archive';

function parseTotalSizeFromContentRange(
  contentRange: string | undefined,
  fallback: number,
): number {
  if (!contentRange) return fallback;
  const match = /\/(\d+)$/.exec(contentRange);
  return match ? Number.parseInt(match[1], 10) : fallback;
}

export class AzureBlobFileStorage implements IFileStorage {
  private readonly serviceClient = BlobServiceClient.fromConnectionString(
    env.AZURE_STORAGE_CONNECTION_STRING,
  );

  private readonly containerClient = this.serviceClient.getContainerClient(
    env.AZURE_STORAGE_CONTAINER,
  );

  private ensureContainerPromise: Promise<void> | null = null;

  private readonly accessTier: AccessTier =
    env.AZURE_STORAGE_ACCESS_TIER === 'Archive' ||
    env.AZURE_STORAGE_ACCESS_TIER === 'Cold' ||
    env.AZURE_STORAGE_ACCESS_TIER === 'Hot'
      ? env.AZURE_STORAGE_ACCESS_TIER
      : 'Cool';

  private async ensureContainer() {
    if (!this.ensureContainerPromise) {
      this.ensureContainerPromise = this.containerClient.createIfNotExists().then(() => undefined);
    }
    await this.ensureContainerPromise;
  }

  async saveStream(stream: Readable, opts: SaveStreamOptions): Promise<SaveFileResult> {
    await this.ensureContainer();

    const key = normalizeStorageKey(opts.key);
    const limiter = new SizeLimitTransform(opts.maxBytes);
    const guardedStream = stream.pipe(limiter);
    const blobClient = this.containerClient.getBlockBlobClient(key);

    try {
      await blobClient.uploadStream(guardedStream, 4 * 1024 * 1024, 5, {
        blobHTTPHeaders: { blobContentType: opts.mime },
        tier: this.accessTier,
      });
    } catch (error) {
      await blobClient.deleteIfExists().catch(() => undefined);
      throw error;
    }

    return {
      url: this.publicUrl(key),
      key,
      mime: opts.mime,
      size: limiter.bytesWritten,
      filename: key.split('/').at(-1) ?? key,
    };
  }

  async saveBuffer(
    buffer: Buffer,
    opts: Omit<SaveStreamOptions, 'maxBytes'>,
  ): Promise<SaveFileResult> {
    await this.ensureContainer();

    const key = normalizeStorageKey(opts.key);
    const blobClient = this.containerClient.getBlockBlobClient(key);
    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: opts.mime },
      tier: this.accessTier,
    });

    return {
      url: this.publicUrl(key),
      key,
      mime: opts.mime,
      size: buffer.length,
      filename: key.split('/').at(-1) ?? key,
    };
  }

  async openReadStream(
    key: string,
    range?: { start: number; end: number } | null,
  ): Promise<ReadFileResult | null> {
    const safeKey = normalizeStorageKey(key);
    const blobClient = this.containerClient.getBlobClient(safeKey);

    try {
      const offset = range?.start;
      const count = range ? range.end - range.start + 1 : undefined;
      const response = await blobClient.download(offset, count);
      const streamBody = response.readableStreamBody;
      if (!streamBody) return null;
      const stream = streamBody as unknown as Readable;

      const contentLength = Number(response.contentLength ?? 0);
      const totalSize = range
        ? parseTotalSizeFromContentRange(response.contentRange, contentLength)
        : contentLength;

      return {
        stream,
        mime: response.contentType ?? guessMimeFromKey(safeKey),
        totalSize,
        contentLength,
        range: range ?? undefined,
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        (error as { statusCode?: number }).statusCode === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  async deleteByKey(key: string): Promise<void> {
    await this.containerClient.getBlobClient(normalizeStorageKey(key)).deleteIfExists();
  }

  publicUrl(key: string): string {
    return buildPublicFileUrl(key);
  }
}
