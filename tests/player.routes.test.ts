import type { FastifyInstance } from 'fastify';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

import { buildServer } from '../src/infra/http/server';

let app: FastifyInstance | undefined;

describe('Player routes', () => {
  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it('GET /api/health', async () => {
    const res = await app!.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
  });

  it('POST /api/players -> create and list', async () => {
    const create = await app!.inject({
      method: 'POST',
      url: '/api/players',
      payload: { name: 'Alys', level: 3 },
    });
    expect(create.statusCode).toBe(201);

    const list = await app!.inject({ method: 'GET', url: '/api/players' });
    expect(list.statusCode).toBe(200);
    const items = list.json();
    expect(Array.isArray(items)).toBe(true);
    expect(items.some((p) => p.name === 'Alys')).toBe(true);
    expect(items.some((p) => p.level === 3)).toBe(true);
  });
  it('POST /api/players -> create with background', async () => {
    const create = await app!.inject({
      method: 'POST',
      url: '/api/players',
      payload: { name: 'Rolf', level: 5, background: 'Hero from the North' },
    });
    expect(create.statusCode).toBe(201);

    const list = await app!.inject({ method: 'GET', url: '/api/players' });
    expect(list.statusCode).toBe(200);
    const items = list.json();
    expect(items.some((p) => p.name === 'Rolf')).toBe(true);
    expect(items.some((p) => p.background === 'Hero from the North')).toBe(true);
  });
  it('GET /api/players/:id -> get non-existent player', async () => {
    const res = await app!.inject({ method: 'GET', url: '/api/players/999999' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.message).toBe('Route GET:/api/players/999999 not found');
  });
  it('GET /api/players/:id -> get player with invalid ID', async () => {
    const res = await app!.inject({ method: 'GET', url: '/api/players/invalid-id' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.message).toBe('Route GET:/api/players/invalid-id not found');
  });
  it('GET /api/players -> list players with no players', async () => {
    const res = await app!.inject({ method: 'GET', url: '/api/players' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });
  it('DELETE /api/players/:id -> delete non-existent player', async () => {
    const res = await app!.inject({ method: 'DELETE', url: '/api/players/999999' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.message).toBe('Route DELETE:/api/players/999999 not found');
  });
  it('DELETE /api/players/:id -> delete player with invalid ID', async () => {
    const res = await app!.inject({ method: 'DELETE', url: '/api/players/invalid-id' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.message).toBe('Route DELETE:/api/players/invalid-id not found');
  });
  it('GET /api/players -> list players with multiple players', async () => {
    const create1 = await app!.inject({
      method: 'POST',
      url: '/api/players',
      payload: { name: 'Player One', level: 1 },
    });
    expect(create1.statusCode).toBe(201);
    const create2 = await app!.inject({
      method: 'POST',
      url: '/api/players',
      payload: { name: 'Player Two', level: 2 },
    });
    expect(create2.statusCode).toBe(201);

    const list = await app!.inject({ method: 'GET', url: '/api/players' });
    expect(list.statusCode).toBe(200);
    const items = list.json();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.some((p) => p.name === 'Player One')).toBe(true);
    expect(items.some((p) => p.name === 'Player Two')).toBe(true);
  });
  it('GET /api/players -> list players with single player', async () => {
    const create = await app!.inject({
      method: 'POST',
      url: '/api/players',
      payload: { name: 'Single Player', level: 1 },
    });
    expect(create.statusCode).toBe(201);
    const player = create.json();

    const list = await app!.inject({ method: 'GET', url: '/api/players' });
    expect(list.statusCode).toBe(200);
    const items = list.json();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(1);
    expect(items[0].id).toBe(player.id);
    expect(items[0].name).toBe('Single Player');
  });
  it('GET /api/players -> list players with no players', async () => {
    const res = await app!.inject({ method: 'GET', url: '/api/players' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });
});
