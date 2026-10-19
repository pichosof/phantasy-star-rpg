import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { BlobServiceClient } from '@azure/storage-blob';

import { env } from '../config/env.js';

export interface BackupEntry {
  name: string;
  sha256: string | null;
  createdAt: Date;
  size: number;
}

/** Where database snapshots are kept. Never exposed through /files/*. */
export interface BackupTarget {
  readonly description: string;
  save(name: string, filePath: string, sha256: string): Promise<void>;
  list(): Promise<BackupEntry[]>; // newest first
  /** Copies a backup to a local file (used by restore). */
  download(name: string, filePath: string): Promise<void>;
  delete(name: string): Promise<void>;
}

/** Private Blob container, separate from the public `uploads` container. */
export class AzureBlobBackupTarget implements BackupTarget {
  private readonly container = BlobServiceClient.fromConnectionString(
    env.AZURE_STORAGE_CONNECTION_STRING,
  ).getContainerClient(env.AZURE_BACKUP_CONTAINER);

  private ready: Promise<unknown> | null = null;

  readonly description = `azure-blob:${env.AZURE_BACKUP_CONTAINER}`;

  private ensure() {
    // No `access` option → container stays private.
    this.ready ??= this.container.createIfNotExists();
    return this.ready;
  }

  async save(name: string, filePath: string, sha256: string) {
    await this.ensure();
    await this.container.getBlockBlobClient(name).uploadFile(filePath, {
      blobHTTPHeaders: { blobContentType: 'application/vnd.sqlite3' },
      metadata: { sha256 },
      tier: 'Cool',
    });
  }

  async list() {
    await this.ensure();
    const out: BackupEntry[] = [];
    for await (const blob of this.container.listBlobsFlat({ includeMetadata: true })) {
      out.push({
        name: blob.name,
        sha256: blob.metadata?.sha256 ?? null,
        createdAt: blob.properties.createdOn ?? blob.properties.lastModified,
        size: blob.properties.contentLength ?? 0,
      });
    }
    return out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async download(name: string, filePath: string) {
    await this.ensure();
    await this.container.getBlockBlobClient(name).downloadToFile(filePath);
  }

  async delete(name: string) {
    await this.container.deleteBlob(name, { deleteSnapshots: 'include' });
  }
}

/** Local directory (dev / local driver). The hash is kept in a `.sha256` sidecar. */
export class LocalBackupTarget implements BackupTarget {
  private readonly dir = path.resolve(env.BACKUP_LOCAL_DIR);

  readonly description = `local:${this.dir}`;

  async save(name: string, filePath: string, sha256: string) {
    await fsp.mkdir(this.dir, { recursive: true });
    await fsp.copyFile(filePath, path.join(this.dir, name));
    await fsp.writeFile(path.join(this.dir, `${name}.sha256`), sha256);
  }

  async list() {
    if (!fs.existsSync(this.dir)) return [];
    const names = (await fsp.readdir(this.dir)).filter((n) => n.endsWith('.db'));
    const out = await Promise.all(
      names.map(async (name) => {
        const full = path.join(this.dir, name);
        const stat = await fsp.stat(full);
        const sha256 = await fsp.readFile(`${full}.sha256`, 'utf8').catch(() => null);
        return { name, sha256, createdAt: stat.mtime, size: stat.size };
      }),
    );
    return out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async download(name: string, filePath: string) {
    await fsp.copyFile(path.join(this.dir, name), filePath);
  }

  async delete(name: string) {
    const full = path.join(this.dir, name);
    await fsp.rm(full, { force: true });
    await fsp.rm(`${full}.sha256`, { force: true });
  }
}

export function createBackupTarget(): BackupTarget {
  return env.FILE_STORAGE_DRIVER === 'azure-blob' && env.AZURE_STORAGE_CONNECTION_STRING
    ? new AzureBlobBackupTarget()
    : new LocalBackupTarget();
}
