import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { env } from '../src/infra/config/env';

import { createTestApi, type TestApi } from './helpers';

let api: TestApi;
beforeAll(async () => {
  api = await createTestApi();
});
afterAll(async () => {
  await api.close();
});
afterEach(() => {
  vi.unstubAllGlobals();
  env.ANTHROPIC_API_KEY = '';
});

const show = (path: string, id: number) =>
  api.gm({ method: 'PATCH', url: `/api/${path}/${id}/visibility`, payload: { visible: true } });

async function seed() {
  const npc = (
    await api.gm({
      method: 'POST',
      url: '/api/npcs',
      payload: { name: 'Oren Tal', description: 'Motavian aide.' },
    })
  ).json();
  const secret = (
    await api.gm({
      method: 'POST',
      url: '/api/npcs',
      payload: { name: 'Cael Varen', description: 'Secret patron.' },
    })
  ).json();
  const wiki = (
    await api.gm({
      method: 'POST',
      url: '/api/wiki',
      payload: {
        title: 'Piata University',
        content: 'Run by [[Cael Varen]]. Reports go through [[npc:Oren Tal|the aide]].',
        visible: true,
      },
    })
  ).json();
  const created = (
    await api.gm({
      method: 'POST',
      url: '/api/sessions',
      payload: { title: 'Session 1', date: 'AW 2284', summary: 'The party met Oren Tal in Piata.' },
    })
  ).json();
  // The sessions API serializes the entity as { props: {...} }.
  const session = created.props ?? created;
  await show('npcs', npc.id);
  await show('sessions', session.id);
  return { npc, secret, wiki, session };
}

describe('entity links', () => {
  it('index lists visible entities only to players, everything to the GM', async () => {
    await seed();
    const player = (await api.player({ method: 'GET', url: '/api/links/index' })).json();
    const gm = (await api.gm({ method: 'GET', url: '/api/links/index' })).json();
    const names = (l: { name: string }[]) => l.map((e) => e.name);
    expect(names(player)).toContain('Oren Tal');
    expect(names(player)).not.toContain('Cael Varen');
    expect(names(gm)).toContain('Cael Varen');
  });

  it('"appears in" finds explicit links and plain mentions; history lists sessions', async () => {
    const { npc } = await seed();
    const res = (await api.player({ method: 'GET', url: `/api/links/npc/${npc.id}` })).json();
    expect(res.entity.name).toBe('Oren Tal');
    expect(res.appearsIn).toEqual([
      expect.objectContaining({ type: 'wiki', name: 'Piata University', explicit: true }),
    ]);
    expect(res.history.sessions).toEqual([
      expect.objectContaining({ type: 'session', name: 'Session 1', explicit: false }),
    ]);
  });

  it('a hidden entity is 404 for players and visible for the GM', async () => {
    const { secret } = await seed();
    expect(
      (await api.player({ method: 'GET', url: `/api/links/npc/${secret.id}` })).statusCode,
    ).toBe(404);
    const gm = await api.gm({ method: 'GET', url: `/api/links/npc/${secret.id}` });
    expect(gm.statusCode).toBe(200);
    expect(gm.json().appearsIn.map((m: { name: string }) => m.name)).toEqual(['Piata University']);
  });

  it('hidden sources never show up in mentions for players', async () => {
    const { npc } = await seed();
    await api.gm({
      method: 'POST',
      url: '/api/lores',
      payload: { title: 'Secret plan', content: 'Watch [[Oren Tal]].', visible: false },
    });
    const player = (await api.player({ method: 'GET', url: `/api/links/npc/${npc.id}` })).json();
    expect(player.appearsIn.map((m: { name: string }) => m.name)).not.toContain('Secret plan');
    const gm = (await api.gm({ method: 'GET', url: `/api/links/npc/${npc.id}` })).json();
    expect(gm.appearsIn.map((m: { name: string }) => m.name)).toContain('Secret plan');
  });

  it('rejects unknown types', async () => {
    expect((await api.player({ method: 'GET', url: '/api/links/spaceship/1' })).statusCode).toBe(
      404,
    );
  });
});

describe('session diary', () => {
  it('is GM-only and stores notes', async () => {
    const { session } = await seed();
    expect(
      (await api.player({ method: 'GET', url: `/api/gm/sessions/${session.id}/diary` })).statusCode,
    ).toBe(401);
    const put = await api.gm({
      method: 'PUT',
      url: `/api/gm/sessions/${session.id}/diary`,
      payload: { notes: '- met Oren Tal' },
    });
    expect(put.statusCode).toBe(200);
    const got = (
      await api.gm({ method: 'GET', url: `/api/gm/sessions/${session.id}/diary` })
    ).json();
    expect(got.notes).toBe('- met Oren Tal');
    expect((await api.gm({ method: 'GET', url: '/api/gm/sessions/999999/diary' })).statusCode).toBe(
      404,
    );
  });

  it('AI summary is off without a key (503)', async () => {
    const { session } = await seed();
    expect((await api.gm({ method: 'GET', url: '/api/gm/ai/status' })).json()).toEqual({
      enabled: false,
    });
    const res = await api.gm({
      method: 'POST',
      url: `/api/gm/sessions/${session.id}/diary/summarize`,
      payload: { notes: '- met Oren Tal' },
    });
    expect(res.statusCode).toBe(503);
  });

  it('AI summary calls the Messages API with the notes and linkable names', async () => {
    const { session } = await seed();
    env.ANTHROPIC_API_KEY = 'test-key';
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ content: [{ type: 'text', text: '## Summary\nMet [[Oren Tal]].' }] }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await api.gm({
      method: 'POST',
      url: `/api/gm/sessions/${session.id}/diary/summarize`,
      payload: { notes: '- met oren in piata' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().markdown).toContain('[[Oren Tal]]');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('test-key');
    const body = JSON.parse(init.body);
    expect(body.messages[0].content).toContain('- met oren in piata');
    expect(body.messages[0].content).toContain('Cael Varen'); // GM context: hidden names are linkable
  });

  it('AI errors become 502', async () => {
    const { session } = await seed();
    env.ANTHROPIC_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('overloaded', { status: 529 })),
    );
    const res = await api.gm({
      method: 'POST',
      url: `/api/gm/sessions/${session.id}/diary/summarize`,
      payload: { notes: 'x' },
    });
    expect(res.statusCode).toBe(502);
  });
});
