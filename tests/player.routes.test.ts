import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { buildServer } from '../src/infra/http/server';

let app: Awaited<ReturnType<typeof buildServer>>;

describe('Player routes', () => {
  beforeAll(async () => {
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
  });

  it('POST /api/players -> create and list', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/players',
      payload: { name: 'Alys', level: 3 },
    });
    expect(create.statusCode).toBe(201);

    const list = await app.inject({ method: 'GET', url: '/api/players' });
    expect(list.statusCode).toBe(200);
    const items = list.json();
    expect(Array.isArray(items)).toBe(true);
    expect(items.some((p: any) => p.name === 'Alys')).toBe(true);
  });
});
