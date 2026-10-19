import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApi, type TestApi } from './helpers';

let api: TestApi;

beforeAll(async () => {
  api = await createTestApi();
});
afterAll(async () => {
  await api.close();
});

const combatant = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  kind: 'monster',
  name: 'Biomonster',
  refId: null,
  initiative: 14,
  initBonus: 2,
  sp: { current: 0, max: 0 },
  hp: { current: 20, max: 20 },
  rp: { current: 0, max: 0 },
  eac: 13,
  kac: 15,
  conditions: [{ id: 'k1', name: 'Flat-footed', rounds: 1 }],
  defeated: false,
  ...over,
});

const state = (over: Record<string, unknown> = {}) => ({
  round: 1,
  turn: 0,
  combatants: [combatant()],
  log: [],
  ...over,
});

const create = async (payload: Record<string, unknown> = { name: 'Ambush at Piata' }) => {
  const res = await api.gm({ method: 'POST', url: '/api/gm/encounters', payload });
  expect(res.statusCode).toBe(201);
  return res.json() as { id: number; version: number; status: string; state: unknown };
};

describe('encounters (combat tracker)', () => {
  it('is GM-only', async () => {
    expect((await api.player({ method: 'GET', url: '/api/gm/encounters' })).statusCode).toBe(401);
    const res = await api.player({
      method: 'POST',
      url: '/api/gm/encounters',
      payload: { name: 'x' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('creates an empty encounter and lists it', async () => {
    const e = await create();
    expect(e.version).toBe(1);
    expect(e.status).toBe('active');
    expect(e.state).toEqual({ round: 0, turn: 0, combatants: [], log: [] });
    const list = (await api.gm({ method: 'GET', url: '/api/gm/encounters' })).json();
    expect(list.map((x: { id: number }) => x.id)).toEqual([e.id]);
  });

  it('saves the state and bumps the version; get returns it', async () => {
    const e = await create();
    const res = await api.gm({
      method: 'PUT',
      url: `/api/gm/encounters/${e.id}`,
      payload: { version: 1, state: state() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().version).toBe(2);

    const got = (await api.gm({ method: 'GET', url: `/api/gm/encounters/${e.id}` })).json();
    expect(got.state.combatants[0].name).toBe('Biomonster');
    expect(got.version).toBe(2);
  });

  it('rejects a stale save with 409, and force overwrites', async () => {
    const e = await create();
    await api.gm({
      method: 'PUT',
      url: `/api/gm/encounters/${e.id}`,
      payload: { version: 1, state: state() },
    });

    // A second device still on version 1.
    const stale = await api.gm({
      method: 'PUT',
      url: `/api/gm/encounters/${e.id}`,
      payload: { version: 1, state: state({ round: 9 }) },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().currentVersion).toBe(2);

    const forced = await api.gm({
      method: 'PUT',
      url: `/api/gm/encounters/${e.id}`,
      payload: { version: 1, force: true, state: state({ round: 9 }) },
    });
    expect(forced.statusCode).toBe(200);
    expect(forced.json().version).toBe(3);
    expect(forced.json().state.round).toBe(9);
  });

  it('validates the state shape', async () => {
    const e = await create();
    const res = await api.gm({
      method: 'PUT',
      url: `/api/gm/encounters/${e.id}`,
      payload: {
        version: 1,
        state: state({ combatants: [combatant({ hp: { current: 'lots' } })] }),
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('state.combatants.0.hp.current');
  });

  it('ends, renames and deletes an encounter', async () => {
    const e = await create();
    const ended = await api.gm({
      method: 'PUT',
      url: `/api/gm/encounters/${e.id}`,
      payload: { version: 1, status: 'ended', name: 'Ambush (won)' },
    });
    expect(ended.json()).toMatchObject({ status: 'ended', name: 'Ambush (won)' });

    expect((await api.gm({ method: 'DELETE', url: `/api/gm/encounters/${e.id}` })).statusCode).toBe(
      204,
    );
    expect((await api.gm({ method: 'GET', url: `/api/gm/encounters/${e.id}` })).statusCode).toBe(
      404,
    );
  });

  it('links an encounter to a session, and survives the session being deleted', async () => {
    const session = (
      await api.gm({
        method: 'POST',
        url: '/api/sessions',
        payload: { title: 'S1', date: '2026-10-19' },
      })
    ).json();
    const e = await create({ name: 'With session', sessionId: session.id });
    await api.gm({ method: 'DELETE', url: `/api/sessions/${session.id}` });
    const got = (await api.gm({ method: 'GET', url: `/api/gm/encounters/${e.id}` })).json();
    expect(got.sessionId).toBeNull();
  });
});
