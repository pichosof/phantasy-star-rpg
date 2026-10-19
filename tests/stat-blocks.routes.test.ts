import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApi, type TestApi } from './helpers';

let api: TestApi;
beforeAll(async () => {
  api = await createTestApi();
});
afterAll(async () => {
  await api.close();
});

const block = (over: Record<string, unknown> = {}) => ({
  label: 'Adulta',
  cr: '5',
  xp: 1600,
  initiative: 6,
  hp: 68,
  eac: 17,
  kac: 19,
  fort: 14,
  ref: 11,
  will: 9,
  attacks: [{ name: 'Mordida', bonus: 13, damage: '2d6+8 P' }],
  abilities: [{ name: 'Agarrar', text: 'Imobiliza a presa.' }],
  ...over,
});

const createMonster = async (name = 'Aranha-Leão') =>
  (await api.gm({ method: 'POST', url: '/api/bestiary', payload: { name } })).json() as {
    id: number;
  };

describe('bestiary stat blocks', () => {
  it('is GM-only', async () => {
    const res = await api.player({ method: 'GET', url: '/api/gm/bestiary/stat-blocks' });
    expect(res.statusCode).toBe(401);
  });

  it('stores, lists, replaces and clears the blocks of a creature', async () => {
    const m = await createMonster();
    const put = await api.gm({
      method: 'PUT',
      url: `/api/gm/bestiary/${m.id}/stat-blocks`,
      payload: { blocks: [block(), block({ label: 'Filhote', cr: '1', hp: 20 })] },
    });
    expect(put.statusCode).toBe(200);

    let all = (await api.gm({ method: 'GET', url: '/api/gm/bestiary/stat-blocks' })).json();
    expect(all).toHaveLength(1);
    expect(all[0].blocks.map((b: { label: string }) => b.label)).toEqual(['Adulta', 'Filhote']);

    await api.gm({
      method: 'PUT',
      url: `/api/gm/bestiary/${m.id}/stat-blocks`,
      payload: { blocks: [] },
    });
    all = (await api.gm({ method: 'GET', url: '/api/gm/bestiary/stat-blocks' })).json();
    expect(all).toEqual([]);
  });

  it('rejects invalid blocks and unknown creatures', async () => {
    const m = await createMonster();
    const bad = await api.gm({
      method: 'PUT',
      url: `/api/gm/bestiary/${m.id}/stat-blocks`,
      payload: { blocks: [block({ hp: 'lots' })] },
    });
    expect(bad.statusCode).toBe(400);
    const missing = await api.gm({
      method: 'PUT',
      url: '/api/gm/bestiary/999999/stat-blocks',
      payload: { blocks: [block()] },
    });
    expect(missing.statusCode).toBe(404);
  });

  it('is removed with the creature', async () => {
    const m = await createMonster();
    await api.gm({
      method: 'PUT',
      url: `/api/gm/bestiary/${m.id}/stat-blocks`,
      payload: { blocks: [block()] },
    });
    await api.gm({ method: 'DELETE', url: `/api/bestiary/${m.id}` });
    expect((await api.gm({ method: 'GET', url: '/api/gm/bestiary/stat-blocks' })).json()).toEqual(
      [],
    );
  });
});
