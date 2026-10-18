import fs from 'node:fs';
import fsp from 'node:fs/promises';

import type { FastifyInstance } from 'fastify';

import { sqliteBackup } from '../../backup/sqlite-backup.service.js';

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
}
