import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApi, type TestApi } from './helpers';

let api: TestApi;
beforeAll(async () => {
  api = await createTestApi();
});
afterAll(async () => {
  await api.close();
});

const unwrap = <T>(x: { props?: T } & T): T => x.props ?? x;

async function seed() {
  const rook = (
    await api.gm({ method: 'POST', url: '/api/players', payload: { name: 'Rook' } })
  ).json();
  const kiran = (
    await api.gm({ method: 'POST', url: '/api/players', payload: { name: 'Kiran' } })
  ).json();
  await api.gm({
    method: 'PATCH',
    url: `/api/players/${rook.id}/visibility`,
    payload: { visible: true },
  });
  const s1 = unwrap(
    (
      await api.gm({
        method: 'POST',
        url: '/api/sessions',
        payload: { title: 'S1', date: 'AW 2284' },
      })
    ).json(),
  ) as { id: number };
  const s2 = unwrap(
    (
      await api.gm({
        method: 'POST',
        url: '/api/sessions',
        payload: { title: 'Secret S2', date: 'AW 2284' },
      })
    ).json(),
  ) as { id: number };
  await api.gm({
    method: 'PATCH',
    url: `/api/sessions/${s1.id}/visibility`,
    payload: { visible: true },
  });
  return { rook, kiran, s1, s2 };
}

const reward = (sessionId: number, rewards: unknown[]) =>
  api.gm({ method: 'PUT', url: `/api/gm/sessions/${sessionId}/rewards`, payload: { rewards } });

describe('player progress', () => {
  it('GM awards a session; editing replaces it; zero rows are dropped', async () => {
    const { rook, kiran, s1 } = await seed();
    let res = await reward(s1.id, [
      { playerId: rook.id, xp: 400, credits: 150, note: 'Saved the caravan' },
      { playerId: kiran.id, xp: 400, credits: 0 },
    ]);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);

    res = await reward(s1.id, [
      { playerId: rook.id, xp: 500, credits: 150 },
      { playerId: kiran.id, xp: 0, credits: 0 },
    ]);
    expect(res.json()).toEqual([
      expect.objectContaining({ playerId: rook.id, xp: 500, credits: 150, note: null }),
    ]);
  });

  it('totals add up across sessions; players see their progress but not hidden session titles', async () => {
    const { rook, s1, s2 } = await seed();
    await reward(s1.id, [{ playerId: rook.id, xp: 400, credits: 100 }]);
    await reward(s2.id, [{ playerId: rook.id, xp: 600, credits: -20, note: 'Bought a laser' }]);

    const asPlayer = await api.player({ method: 'GET', url: `/api/players/${rook.id}/progress` });
    expect(asPlayer.statusCode).toBe(200);
    const body = asPlayer.json();
    expect(body.totals).toEqual({ xp: 1000, credits: 80 });
    expect(body.entries.map((e: { sessionTitle: string | null }) => e.sessionTitle)).toEqual([
      'S1',
      null,
    ]);

    const asGM = (await api.gm({ method: 'GET', url: `/api/players/${rook.id}/progress` })).json();
    expect(asGM.entries.map((e: { sessionTitle: string }) => e.sessionTitle)).toEqual([
      'S1',
      'Secret S2',
    ]);
  });

  it('hidden players are 404 for players', async () => {
    const { kiran } = await seed();
    expect(
      (await api.player({ method: 'GET', url: `/api/players/${kiran.id}/progress` })).statusCode,
    ).toBe(404);
    expect(
      (await api.gm({ method: 'GET', url: `/api/players/${kiran.id}/progress` })).statusCode,
    ).toBe(200);
  });

  it('only the GM can award, with valid players and no duplicates', async () => {
    const { rook, s1 } = await seed();
    const asPlayer = await api.player({
      method: 'PUT',
      url: `/api/gm/sessions/${s1.id}/rewards`,
      payload: { rewards: [] },
    });
    expect(asPlayer.statusCode).toBe(401);
    expect((await reward(s1.id, [{ playerId: 999999, xp: 1 }])).statusCode).toBe(404);
    expect(
      (
        await reward(s1.id, [
          { playerId: rook.id, xp: 1 },
          { playerId: rook.id, xp: 2 },
        ])
      ).statusCode,
    ).toBe(400);
    expect((await reward(999999, [])).statusCode).toBe(404);
  });

  it('progress survives the session being deleted (session link cleared)', async () => {
    const { rook, s1 } = await seed();
    await reward(s1.id, [{ playerId: rook.id, xp: 300 }]);
    await api.gm({ method: 'DELETE', url: `/api/sessions/${s1.id}` });
    const body = (await api.gm({ method: 'GET', url: `/api/players/${rook.id}/progress` })).json();
    expect(body.totals.xp).toBe(300);
    expect(body.entries[0].sessionId).toBeNull();
  });
});
