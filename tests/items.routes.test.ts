import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApi, type TestApi } from './helpers';

let api: TestApi;
beforeAll(async () => {
  api = await createTestApi();
});
afterAll(async () => {
  await api.close();
});

const GM_FIELDS = [
  'access',
  'refPrice',
  'channel',
  'tags',
  'shops',
  'loot',
  'policies',
  'flags',
  'gmNotes',
  'audit',
  'visibility',
  'status',
];

const base = (code: string, extra: Record<string, unknown> = {}) => ({
  code,
  name: `Item ${code}`,
  kind: 'tech',
  level: 1,
  description: 'Player text',
  refPrice: 100,
  access: 'free',
  channel: 'Oficina de Piata',
  gmNotes: 'Segredo do mestre',
  audit: { justificativa: 'parecer' },
  ...extra,
});

describe('items', () => {
  it('players only see published public items, without GM fields', async () => {
    const tag = `T${Date.now()}`;
    const res = await api.gm({
      method: 'POST',
      url: '/api/gm/items/import',
      payload: {
        items: [
          base(`${tag}-pub`, { visibility: 'public', status: 'published' }),
          base(`${tag}-draft`, { visibility: 'public', status: 'approved' }),
          base(`${tag}-gm`, { visibility: 'gm', status: 'published', access: 'relic' }),
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ created: 3, updated: 0 });

    const list = (await api.player({ method: 'GET', url: '/api/items' })).json() as Array<
      Record<string, unknown>
    >;
    const mine = list.filter((i) => String(i.code).startsWith(tag));
    expect(mine.map((i) => i.code)).toEqual([`${tag}-pub`]);
    for (const k of GM_FIELDS) expect(mine[0]).not.toHaveProperty(k);
    expect(mine[0].availability).toBe('Common trade');
    expect(mine[0]).toMatchObject({ type: 'Other technology', damageType: null });
    expect(JSON.stringify(list)).not.toContain('Segredo do mestre');

    const gmList = (await api.gm({ method: 'GET', url: '/api/gm/items' })).json() as Array<
      Record<string, unknown>
    >;
    const gmMine = gmList.filter((i) => String(i.code).startsWith(tag));
    expect(gmMine).toHaveLength(3);
    expect(gmMine[0]).not.toHaveProperty('audit'); // list is light; audit on detail
    const hidden = gmMine.find((i) => i.code === `${tag}-gm`) as { id: number };

    expect((await api.player({ method: 'GET', url: `/api/items/${hidden.id}` })).statusCode).toBe(
      404,
    );
    expect((await api.player({ method: 'GET', url: '/api/gm/items' })).statusCode).toBe(401);
    const detail = (await api.gm({ method: 'GET', url: `/api/gm/items/${hidden.id}` })).json();
    expect(detail.audit).toEqual({ justificativa: 'parecer' });

    // search: players never find the GM-only item
    const search = (
      await api.player({ method: 'GET', url: `/api/search?q=${tag}` })
    ).json() as Array<{ type: string; name: string }>;
    expect(search.filter((r) => r.type === 'item').map((r) => r.name)).toEqual([`Item ${tag}-pub`]);
  });

  it('import upserts by code and GM can create, edit and delete', async () => {
    const code = `U${Date.now()}`;
    await api.gm({ method: 'POST', url: '/api/gm/items/import', payload: { items: [base(code)] } });
    const again = await api.gm({
      method: 'POST',
      url: '/api/gm/items/import',
      payload: { items: [base(code, { name: 'Renamed' })] },
    });
    expect(again.json()).toEqual({ created: 0, updated: 1 });

    const created = await api.gm({
      method: 'POST',
      url: '/api/gm/items',
      payload: base(`${code}-new`, { localName: 'Nome local' }),
    });
    expect(created.statusCode).toBe(201);
    const { id } = created.json() as { id: number };
    expect(
      (await api.gm({ method: 'POST', url: '/api/gm/items', payload: base(`${code}-new`) }))
        .statusCode,
    ).toBe(409);

    const patched = await api.gm({
      method: 'PATCH',
      url: `/api/gm/items/${id}`,
      payload: { status: 'published', visibility: 'public', localPrice: 120 },
    });
    expect(patched.json()).toMatchObject({
      status: 'published',
      localPrice: 120,
      gmNotes: 'Segredo do mestre',
    });
    const seen = (await api.player({ method: 'GET', url: `/api/items/${id}` })).json();
    expect(seen).toMatchObject({
      name: 'Nome local',
      originalName: `Item ${code}-new`,
      localPrice: 120,
    });

    expect((await api.gm({ method: 'DELETE', url: `/api/gm/items/${id}` })).statusCode).toBe(204);
    expect((await api.gm({ method: 'GET', url: `/api/gm/items/${id}` })).statusCode).toBe(404);
  });

  it('rejects invalid input', async () => {
    const res = await api.gm({
      method: 'POST',
      url: '/api/gm/items',
      payload: { code: 'X', name: '', kind: 'tech' },
    });
    expect(res.statusCode).toBe(400);
    const bad = await api.gm({
      method: 'POST',
      url: '/api/gm/items/import',
      payload: { items: [base('Y', { access: 'everywhere' })] },
    });
    expect(bad.statusCode).toBe(400);
  });
});
