import fs from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/infra/config/env';

import { createTestApi, type TestApi } from './helpers';

let api: TestApi;
beforeAll(async () => {
  api = await createTestApi();
  fs.mkdirSync(path.join(env.UPLOADS_LOCAL_DIR, 'files-test'), { recursive: true });
  fs.writeFileSync(path.join(env.UPLOADS_LOCAL_DIR, 'files-test', 'hello.txt'), 'hello');
});
afterAll(async () => {
  fs.rmSync(path.join(env.UPLOADS_LOCAL_DIR, 'files-test'), { recursive: true, force: true });
  await api.close();
});

describe('GET /files/*', () => {
  it('serves a stored file', async () => {
    const res = await api.player({ method: 'GET', url: '/files/files-test/hello.txt' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('hello');
  });

  it.each([
    '/files/..%2f..%2fpackage.json',
    '/files/..%5c..%5cpackage.json',
    '/files/files-test%2f..%2f..%2f..%2fpackage.json',
    '/files/files-test/%2e%2e%2f%2e%2e%2f..%2fpackage.json',
    '/files/files-test/.%2fhello.txt',
    '/files/files-test/%00hello.txt',
  ])('refuses %s', async (url) => {
    for (const q of ['', '?w=320']) {
      const res = await api.player({ method: 'GET', url: url + q });
      expect(res.statusCode).toBe(404);
      expect(res.body).not.toContain('picho-rpg-backend');
    }
  });

  it('rejects a malformed escape before the handler', async () => {
    const res = await api.player({ method: 'GET', url: '/files/%E0%A4%A' });
    expect(res.statusCode).toBe(400);
  });
});
