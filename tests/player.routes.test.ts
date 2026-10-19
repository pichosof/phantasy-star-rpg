import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApi, type TestApi } from './helpers';

type PlayerDto = {
  id: number;
  name: string;
  level: number;
  background?: string | null;
  visible?: boolean;
};

let api: TestApi;

beforeAll(async () => {
  api = await createTestApi();
});
afterAll(async () => {
  await api.close();
});

const createPlayer = async (payload: Record<string, unknown>) => {
  const res = await api.gm({ method: 'POST', url: '/api/players', payload });
  expect(res.statusCode).toBe(201);
  return res.json() as PlayerDto;
};

describe('health and client gate', () => {
  it('GET /api/health needs no credentials', async () => {
    const res = await api.app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('rejects /api requests without the client secret', async () => {
    const res = await api.app.inject({ method: 'GET', url: '/api/players' });
    expect(res.statusCode).toBe(403);
  });

  it('rejects a wrong GM key', async () => {
    const res = await api.player({
      method: 'POST',
      url: '/api/auth/login',
      payload: { apiKey: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('players', () => {
  it('lists nothing on an empty database', async () => {
    const res = await api.gm({ method: 'GET', url: '/api/players' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('GM creates players and lists them', async () => {
    const alys = await createPlayer({ name: 'Alys', level: 3 });
    await createPlayer({ name: 'Rolf', level: 5, background: 'Hero from the North' });

    const items = (await api.gm({ method: 'GET', url: '/api/players' })).json() as PlayerDto[];
    expect(items).toHaveLength(2);
    expect(items.find((p) => p.id === alys.id)?.level).toBe(3);
    expect(items.find((p) => p.name === 'Rolf')?.background).toBe('Hero from the North');
  });

  it('a player (non-GM) cannot create', async () => {
    const res = await api.player({
      method: 'POST',
      url: '/api/players',
      payload: { name: 'Nope' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('validates the body', async () => {
    const res = await api.gm({ method: 'POST', url: '/api/players', payload: { level: 2 } });
    expect(res.statusCode).toBe(400);
  });

  it('hidden players are filtered out for non-GM callers', async () => {
    const shown = await createPlayer({ name: 'Shown' });
    const hidden = await createPlayer({ name: 'Hidden' });
    expect(hidden.visible).toBe(false);
    // Players are created hidden; reveal one.
    const vis = await api.gm({
      method: 'PATCH',
      url: `/api/players/${shown.id}/visibility`,
      payload: { visible: true },
    });
    expect(vis.statusCode).toBe(204);

    const asPlayer = (
      await api.player({ method: 'GET', url: '/api/players' })
    ).json() as PlayerDto[];
    expect(asPlayer.map((p) => p.id)).toEqual([shown.id]);

    const asGM = (await api.gm({ method: 'GET', url: '/api/players' })).json() as PlayerDto[];
    expect(asGM.map((p) => p.id).sort()).toEqual([shown.id, hidden.id].sort());
  });

  it('GM updates a player', async () => {
    const p = await createPlayer({ name: 'Chaz', level: 1 });
    const res = await api.gm({
      method: 'PATCH',
      url: `/api/players/${p.id}`,
      payload: { level: 7 },
    });
    expect(res.statusCode).toBe(204);
    const items = (await api.gm({ method: 'GET', url: '/api/players' })).json() as PlayerDto[];
    expect(items.find((x) => x.id === p.id)?.level).toBe(7);
  });

  it('GM deletes a player', async () => {
    const p = await createPlayer({ name: 'Temp' });
    const res = await api.gm({ method: 'DELETE', url: `/api/players/${p.id}` });
    expect([200, 204]).toContain(res.statusCode);
    expect((await api.gm({ method: 'GET', url: '/api/players' })).json()).toEqual([]);
  });

  it('rejects a non-numeric id', async () => {
    const res = await api.gm({ method: 'DELETE', url: '/api/players/not-a-number' });
    expect(res.statusCode).toBe(400);
  });
});
