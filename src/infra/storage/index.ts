import { env } from '../config/env.js';

import { AzureBlobFileStorage } from './azure-blob.file-storage.js';
import { extractStorageKeyFromUrl } from './file-storage.utils.js';
import { LocalFileStorage } from './local-file.storage.js';

function createFileStorage() {
  if (env.FILE_STORAGE_DRIVER === 'azure-blob') {
    if (!env.AZURE_STORAGE_CONNECTION_STRING) {
      throw new Error(
        'AZURE_STORAGE_CONNECTION_STRING is required when FILE_STORAGE_DRIVER=azure-blob',
      );
    }
    return new AzureBlobFileStorage();
  }

  return new LocalFileStorage();
}

export const fileStorage = createFileStorage();

export async function deleteStoredFileByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const key = extractStorageKeyFromUrl(url);
  if (!key) return;
  await fileStorage.deleteByKey(key);
}
