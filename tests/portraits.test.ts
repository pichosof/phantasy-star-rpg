import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  CheckPortraitJob,
  CompletePortraitJob,
  DeletePortraitJob,
  GenerateNpcPortrait,
  type GeneratorTaskState,
  npcPortraitText,
  type PortraitFiles,
  type PortraitGenerator,
} from '../src/core/use-cases/portraits/portraits';
import { container } from '../src/di/container';

import { createTestApi, type TestApi } from './helpers';

let api: TestApi;
beforeAll(async () => {
  api = await createTestApi();
});
afterAll(async () => {
  await api.close();
});

const WEBHOOK = `/hooks/fotor/${process.env.FOTOR_WEBHOOK_SECRET}`;

async function createNpc(over: Record<string, unknown> = {}) {
  const res = await api.gm({
    method: 'POST',
    url: '/api/npcs',
    payload: { name: 'Hala', role: 'Mechanic', location: 'Piata', ...over },
  });
  expect(res.statusCode).toBe(201);
  const body = res.json() as { id?: number; props?: { id: number } };
  return Number(body.id ?? body.props?.id);
}

const putProfile = (key: string, prompt: string, references: string[] = []) =>
  api.gm({
    method: 'PUT',
    url: `/api/gm/portrait-profiles/${encodeURIComponent(key)}`,
    payload: { prompt, references },
  });

/** A generator whose task answers are set by the test; it never calls Fotor. */
class FakeGenerator implements PortraitGenerator {
  enabled = true;
  submitted: { prompt: string; references: string[] }[] = [];
  state: GeneratorTaskState = { state: 'pending' };
  fetchFails = false;
  fetches = 0;
  async submit(input: { prompt: string; references: string[] }) {
    this.submitted.push(input);
    return `task-${Date.now()}-${this.submitted.length}`;
  }
  async status() {
    return this.state;
  }
  async fetchResult() {
    this.fetches++;
    if (this.fetchFails) throw new Error('network down');
    return { data: Buffer.from('jpeg'), mime: 'image/jpeg' };
  }
}

class FakeFiles implements PortraitFiles {
  saved = 0;
  deleted: string[] = [];
  async save(npcId: number, data: Buffer, mime: string) {
    this.saved++;
    return { url: `/files/npcs/portraits/${npcId}-${this.saved}.jpg`, mime, size: data.length };
  }
  async delete(url: string) {
    this.deleted.push(url);
  }
}

function useCases() {
  const generator = new FakeGenerator();
  const files = new FakeFiles();
  const jobs = container.resolve('portraitJobRepo');
  const npcs = container.resolve('portraitNpcs');
  const complete = new CompletePortraitJob(jobs, npcs, generator, files);
  return {
    generator,
    files,
    generate: new GenerateNpcPortrait(npcs, jobs, generator),
    complete,
    check: new CheckPortraitJob(jobs, complete),
    remove: new DeletePortraitJob(jobs, npcs, files),
  };
}

const request = {
  profile: 'Motaviano',
  prompt: 'A motavian mechanic',
  references: ['/files/a.png'],
};

describe('NPC race', () => {
  it('is saved on create and update', async () => {
    const id = await createNpc({ race: 'Motaviano' });
    expect((await container.resolve('portraitNpcs').find(id))?.race).toBe('Motaviano');
    await api.gm({ method: 'PATCH', url: `/api/npcs/${id}`, payload: { race: 'Palmaniano' } });
    expect((await container.resolve('portraitNpcs').find(id))?.race).toBe('Palmaniano');
  });
});

describe('Portrait profiles and draft', () => {
  it('are GM only', async () => {
    expect((await api.player({ method: 'GET', url: '/api/gm/portrait-profiles' })).statusCode).toBe(
      401,
    );
  });

  it('rejects references that are neither uploads nor https', async () => {
    const res = await putProfile('style', 'Painted', ['http://example.com/a.png']);
    expect(res.statusCode).toBe(400);
  });

  it('drafts from style + race + NPC, leaving GM secrets out', async () => {
    await putProfile('style', 'Painted illustration, yellowish sky, no moon', ['/files/style.png']);
    await putProfile('Motaviano', 'Avian humanoid, curved beak, tall ears', [
      '/files/male.png',
      '/files/female.png',
    ]);
    const id = await createNpc({
      race: 'Motaviano',
      description:
        '**Motaviano**, adult. Goggles on the head.\n\n> **Segredo (GM):** works for the cult.',
    });

    const res = await api.gm({ method: 'GET', url: `/api/gm/npcs/${id}/portrait/draft` });
    expect(res.statusCode).toBe(200);
    const draft = res.json() as { profile: string; prompt: string; references: string[] };
    expect(draft.profile).toBe('Motaviano');
    expect(draft.prompt).toContain('Hala — Mechanic — Piata');
    expect(draft.prompt).toContain('Goggles on the head');
    expect(draft.prompt).toContain('curved beak');
    expect(draft.prompt).toContain('no moon');
    expect(draft.prompt).not.toContain('cult');
    expect(draft.references).toEqual(['/files/style.png', '/files/male.png', '/files/female.png']);
  });

  it('says what is missing instead of guessing', async () => {
    await putProfile('style', 'Painted');
    const noRace = await createNpc();
    const res = await api.gm({ method: 'GET', url: `/api/gm/npcs/${noRace}/portrait/draft` });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('has no race');

    const unknown = await createNpc({ race: 'Esper' });
    const res2 = await api.gm({ method: 'GET', url: `/api/gm/npcs/${unknown}/portrait/draft` });
    expect(res2.statusCode).toBe(409);
    expect(res2.json().message).toContain('no portrait profile "Esper"');
  });

  it('needs the style profile', async () => {
    await putProfile('Motaviano', 'Avian');
    const id = await createNpc({ race: 'Motaviano' });
    const res = await api.gm({ method: 'GET', url: `/api/gm/npcs/${id}/portrait/draft` });
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toContain('style');
  });

  it('strips Markdown and wiki links from the NPC text', () => {
    const text = npcPortraitText({
      id: 1,
      name: 'Hala',
      role: null,
      location: null,
      race: null,
      imageUrl: null,
      description: 'Works at [[city:Piata|the university]] with **care**.',
    });
    expect(text).toBe('Hala\nWorks at the university with care.');
  });
});

describe('Portrait generation', () => {
  it('stores the finished image and makes it the portrait', async () => {
    const { generator, generate, complete, files } = useCases();
    const id = await createNpc();
    const job = await generate.execute(id, request);
    expect(job.status).toBe('pending');
    expect(generator.submitted[0].references).toEqual(['/files/a.png']);

    expect((await complete.execute(job.taskId))?.status).toBe('pending');

    generator.state = { state: 'done', resultUrl: 'https://pub-static.fotor.com/x.jpg' };
    const done = await complete.execute(job.taskId);
    expect(done?.status).toBe('done');
    expect((await container.resolve('portraitNpcs').find(id))?.imageUrl).toBe(done?.imageUrl);

    // A repeated webhook does not store it twice.
    await complete.execute(job.taskId);
    expect(files.saved).toBe(1);
  });

  it('refuses a second generation while one is running', async () => {
    const { generate } = useCases();
    const id = await createNpc();
    await generate.execute(id, request);
    await expect(generate.execute(id, request)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('reports a blocked image as a failure', async () => {
    const { generator, generate, complete } = useCases();
    const id = await createNpc();
    const job = await generate.execute(id, request);
    generator.state = { state: 'failed', reason: 'Blocked by the Fotor content filter.' };
    const failed = await complete.execute(job.taskId);
    expect(failed).toMatchObject({
      status: 'failed',
      error: 'Blocked by the Fotor content filter.',
    });
  });

  it('a storage failure can be checked again without a new task', async () => {
    const { generator, generate, complete, check } = useCases();
    const id = await createNpc();
    const job = await generate.execute(id, request);
    generator.state = { state: 'done', resultUrl: 'https://pub-static.fotor.com/x.jpg' };
    generator.fetchFails = true;
    const failed = await complete.execute(job.taskId);
    expect(failed?.status).toBe('failed');
    expect(failed?.error).toContain('could not be stored');

    generator.fetchFails = false;
    expect((await check.execute(job.id)).status).toBe('done');
    expect(generator.submitted).toHaveLength(1);
  });

  it('keeps the current portrait from being deleted', async () => {
    const { generator, generate, complete, remove, files } = useCases();
    const id = await createNpc();
    const first = await generate.execute(id, request);
    generator.state = { state: 'done', resultUrl: 'https://pub-static.fotor.com/1.jpg' };
    await complete.execute(first.taskId);
    const second = await generate.execute(id, request);
    const current = await complete.execute(second.taskId);

    await expect(remove.execute(second.id)).rejects.toMatchObject({ statusCode: 409 });
    await remove.execute(first.id);
    expect(files.deleted).toHaveLength(1);
    expect(files.deleted[0]).not.toBe(current?.imageUrl);
  });

  it('switches back to an earlier picture', async () => {
    const { generator, generate, complete } = useCases();
    const id = await createNpc();
    generator.state = { state: 'done', resultUrl: 'https://pub-static.fotor.com/1.jpg' };
    const first = await complete.execute((await generate.execute(id, request)).taskId);
    await complete.execute((await generate.execute(id, request)).taskId);

    const res = await api.gm({ method: 'POST', url: `/api/gm/portraits/${first?.id}/apply` });
    expect(res.statusCode).toBe(204);
    expect((await container.resolve('portraitNpcs').find(id))?.imageUrl).toBe(first?.imageUrl);
  });
});

describe('Fotor webhook', () => {
  it('hides behind its secret', async () => {
    const res = await api.app.inject({
      method: 'POST',
      url: '/hooks/fotor/wrong',
      payload: { taskId: 'x' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('answers 200 and ignores tasks that are not ours', async () => {
    const res = await api.app.inject({
      method: 'POST',
      url: WEBHOOK,
      payload: { taskId: 'not-ours' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects a call without a taskId', async () => {
    const res = await api.app.inject({ method: 'POST', url: WEBHOOK, payload: { status: 1 } });
    expect(res.statusCode).toBe(400);
  });
});
