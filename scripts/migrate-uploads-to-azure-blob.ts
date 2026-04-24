import 'dotenv/config';

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { BlobServiceClient } from '@azure/storage-blob';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

function guessContentType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
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
      return 'application/octet-stream';
  }
}

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectFiles(fullPath);
      if (entry.isFile()) return [fullPath];
      return [];
    }),
  );

  return files.flat();
}

async function main() {
  const connectionString = required('AZURE_STORAGE_CONNECTION_STRING');
  const containerName = required('AZURE_STORAGE_CONTAINER', 'uploads');
  const uploadsDir = path.resolve(required('UPLOADS_LOCAL_DIR', './data/uploads'));
  const tier =
    process.env.AZURE_STORAGE_ACCESS_TIER === 'Archive' ||
    process.env.AZURE_STORAGE_ACCESS_TIER === 'Cold' ||
    process.env.AZURE_STORAGE_ACCESS_TIER === 'Hot'
      ? process.env.AZURE_STORAGE_ACCESS_TIER
      : 'Cool';

  const blobService = BlobServiceClient.fromConnectionString(connectionString);
  const container = blobService.getContainerClient(containerName);
  await container.createIfNotExists();

  const files = await collectFiles(uploadsDir);
  let uploaded = 0;
  let skipped = 0;

  for (const filePath of files) {
    const key = path.relative(uploadsDir, filePath).replace(/\\/g, '/');
    const blob = container.getBlockBlobClient(key);

    if (await blob.exists()) {
      skipped += 1;
      continue;
    }

    await blob.uploadStream(fs.createReadStream(filePath), 4 * 1024 * 1024, 5, {
      blobHTTPHeaders: { blobContentType: guessContentType(filePath) },
      tier,
    });

    uploaded += 1;
    process.stdout.write(`uploaded ${uploaded}/${files.length}: ${key}\n`);
  }

  process.stdout.write(
    `done: ${files.length} files scanned, ${uploaded} uploaded, ${skipped} skipped\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
