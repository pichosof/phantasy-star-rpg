import fsp from 'node:fs/promises';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestApi, type TestApi } from './helpers';

let api: TestApi;

beforeAll(async () => {
  api = await createTestApi();
});
afterAll(async () => {
  await api.close();
});
beforeEach(async () => {
  await fsp.rm(process.env.BACKUP_LOCAL_DIR!, { recursive: true, force: true });
});

const playerNames = async () =>
  ((await api.gm({ method: 'GET', url: '/api/players' })).json() as { name: string }[]).map(
    (p) => p.name,
  );

const createPlayer = (name: string) =>
  api.gm({ method: 'POST', url: '/api/players', payload: { name } });

/** Builds a multipart body by hand (no extra test dependency). */
function multipart(fields: Record<string, string>, file?: { name: string; data: Buffer }) {
  const boundary = '----picho-test-boundary';
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`),
    );
  }
  if (file) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\n` +
          'Content-Type: application/octet-stream\r\n\r\n',
      ),
      file.data,
      Buffer.from('\r\n'),
    );
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(parts),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

describe('database backups and restore', () => {
  it('is GM-only', async () => {
    expect((await api.player({ method: 'GET', url: '/api/gm/database/backups' })).statusCode).toBe(
      401,
    );
    const res = await api.player({
      method: 'POST',
      url: '/api/gm/database/restore',
      payload: { name: 'app-2026-01-01T00-00-00-000Z.db', confirm: 'RESTORE' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('lists backups, newest first', async () => {
    expect((await api.gm({ method: 'GET', url: '/api/gm/database/backups' })).json()).toEqual([]);
    const made = (await api.gm({ method: 'POST', url: '/api/gm/database/backup' })).json();
    expect(made.status).toBe('uploaded');
    const list = (await api.gm({ method: 'GET', url: '/api/gm/database/backups' })).json();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe(made.name);
  });

  it('restores a backup by name and keeps a safety backup of the replaced state', async () => {
    await createPlayer('Before');
    const { name } = (await api.gm({ method: 'POST', url: '/api/gm/database/backup' })).json();
    await createPlayer('After');
    expect(await playerNames()).toEqual(['Before', 'After']);

    const res = await api.gm({
      method: 'POST',
      url: '/api/gm/database/restore',
      payload: { name, confirm: 'RESTORE' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.restoredFrom).toBe(name);
    expect(body.safetyBackup).not.toBe(name);

    expect(await playerNames()).toEqual(['Before']);

    // The safety backup holds the state that was replaced, so the restore can be undone.
    const undo = await api.gm({
      method: 'POST',
      url: '/api/gm/database/restore',
      payload: { name: body.safetyBackup, confirm: 'RESTORE' },
    });
    expect(undo.statusCode).toBe(200);
    expect(await playerNames()).toEqual(['Before', 'After']);
  });

  it('requires the typed confirmation', async () => {
    const { name } = (await api.gm({ method: 'POST', url: '/api/gm/database/backup' })).json();
    const res = await api.gm({
      method: 'POST',
      url: '/api/gm/database/restore',
      payload: { name, confirm: 'yes' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects unknown and malformed backup names', async () => {
    const unknown = await api.gm({
      method: 'POST',
      url: '/api/gm/database/restore',
      payload: { name: 'app-2000-01-01T00-00-00-000Z.db', confirm: 'RESTORE' },
    });
    expect(unknown.statusCode).toBe(400);
    const traversal = await api.gm({
      method: 'POST',
      url: '/api/gm/database/restore',
      payload: { name: '../app.db', confirm: 'RESTORE' },
    });
    expect(traversal.statusCode).toBe(400);
  });

  it('restores from an uploaded database file', async () => {
    await createPlayer('Uploaded');
    const download = await api.gm({ method: 'GET', url: '/api/gm/database/download' });
    expect(download.statusCode).toBe(200);
    await createPlayer('Later');

    const form = multipart({ confirm: 'RESTORE' }, { name: 'picho.db', data: download.rawPayload });
    const res = await api.gm({ method: 'POST', url: '/api/gm/database/restore/upload', ...form });
    expect(res.statusCode).toBe(200);
    expect(res.json().restoredFrom).toBe('upload:picho.db');
    expect(await playerNames()).toEqual(['Uploaded']);
  });

  it('rejects an uploaded file that is not a Picho-RPG database', async () => {
    await createPlayer('Keep');
    const form = multipart(
      { confirm: 'RESTORE' },
      { name: 'evil.db', data: Buffer.from('not a database') },
    );
    const res = await api.gm({ method: 'POST', url: '/api/gm/database/restore/upload', ...form });
    expect(res.statusCode).toBe(400);
    expect(await playerNames()).toEqual(['Keep']);
  });
});
