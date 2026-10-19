import type { FastifyInstance, InjectOptions } from 'fastify';

import { buildServer } from '../src/infra/http/server';

export const CLIENT_SECRET = process.env.CLIENT_SECRET ?? '';

export interface TestApi {
  app: FastifyInstance;
  /** Request as an anonymous player (valid frontend client, no GM token). */
  player: (opts: InjectOptions) => ReturnType<FastifyInstance['inject']>;
  /** Request as the GM (client secret + Bearer JWT). */
  gm: (opts: InjectOptions) => ReturnType<FastifyInstance['inject']>;
  close: () => Promise<void>;
}

export async function createTestApi(): Promise<TestApi> {
  const app = await buildServer();
  await app.ready();

  const withClient = (opts: InjectOptions, extra: Record<string, string> = {}) =>
    app.inject({
      ...opts,
      headers: { 'x-client-id': CLIENT_SECRET, ...extra, ...(opts.headers ?? {}) },
    });

  const login = await withClient({
    method: 'POST',
    url: '/api/auth/login',
    payload: { apiKey: process.env.GM_API_KEY },
  });
  if (login.statusCode !== 200)
    throw new Error(`GM login failed: ${login.statusCode} ${login.body}`);
  const { token } = login.json() as { token: string };

  return {
    app,
    player: (opts) => withClient(opts),
    gm: (opts) => withClient(opts, { authorization: `Bearer ${token}` }),
    close: () => app.close(),
  };
}
