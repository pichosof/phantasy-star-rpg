import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import type { FastifyInstance } from 'fastify';

import {
  BACKUP_NAME,
  InvalidBackupError,
  sqliteBackup,
} from '../../backup/sqlite-backup.service.js';

/** Typed by the GM in the UI; protects against an accidental click. */
const CONFIRM_WORD = 'RESTORE';

export async function databaseRoutes(app: FastifyInstance) {
  // Streams a fresh, consistent snapshot of the whole SQLite DB to the GM.
  app.get(
    '/api/gm/database/download',
    app.withGM({ schema: { tags: ['GM'] } }),
    async (_req, reply) => {
      const snapshot = await sqliteBackup.createSnapshot();
      const { size } = await fsp.stat(snapshot);
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

      const stream = fs.createReadStream(snapshot);
      stream.on('close', () => void fsp.rm(snapshot, { force: true }));

      return reply
        .header('Content-Type', 'application/vnd.sqlite3')
        .header('Content-Length', String(size))
        .header('Content-Disposition', `attachment; filename="picho-rpg-${stamp}.db"`)
        .header('Cache-Control', 'no-store')
        .send(stream);
    },
  );

  // Pushes a backup to the configured target right now (skipped if unchanged).
  app.post('/api/gm/database/backup', app.withGM({ schema: { tags: ['GM'] } }), async () =>
    sqliteBackup.run('manual'),
  );

  // Backups available to restore, newest first.
  app.get('/api/gm/database/backups', app.withGM({ schema: { tags: ['GM'] } }), async () =>
    (await sqliteBackup.listBackups()).map(({ name, size, createdAt }) => ({
      name,
      size,
      createdAt: createdAt.toISOString(),
    })),
  );

  // Restores a stored backup by name. A safety backup of the current DB is taken first.
  app.post<{ Body: { name: string; confirm: string } }>(
    '/api/gm/database/restore',
    app.withGM({
      schema: {
        tags: ['GM'],
        body: {
          type: 'object',
          required: ['name', 'confirm'],
          properties: {
            name: { type: 'string', pattern: BACKUP_NAME.source },
            confirm: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    }),
    async (req, reply) => {
      if (req.body.confirm !== CONFIRM_WORD) {
        return reply
          .code(400)
          .send({ error: 'ConfirmationRequired', message: `Type ${CONFIRM_WORD}.` });
      }
      return sqliteBackup.restore({ name: req.body.name });
    },
  );

  // Restores from an uploaded .db file (e.g. one downloaded earlier).
  // Multipart fields: `confirm` and `file`.
  app.post(
    '/api/gm/database/restore/upload',
    app.withGM({ schema: { tags: ['GM'] } }),
    async (req, reply) => {
      const tmp = path.join(os.tmpdir(), `picho-rpg-upload-${randomUUID()}.db`);
      try {
        let confirm = '';
        let label = '';
        for await (const part of req.parts()) {
          if (part.type === 'field' && part.fieldname === 'confirm') confirm = String(part.value);
          else if (part.type === 'file' && part.fieldname === 'file') {
            label = part.filename || 'upload.db';
            await pipeline(part.file, fs.createWriteStream(tmp));
            if (part.file.truncated)
              throw new InvalidBackupError('File is larger than the upload limit.');
          } else if (part.type === 'file') part.file.resume();
        }
        if (confirm !== CONFIRM_WORD) {
          return reply
            .code(400)
            .send({ error: 'ConfirmationRequired', message: `Type ${CONFIRM_WORD}.` });
        }
        if (!label) throw new InvalidBackupError('Missing "file".');
        return await sqliteBackup.restore({ file: tmp, label: `upload:${label}` });
      } finally {
        await fsp.rm(tmp, { force: true });
      }
    },
  );
}
