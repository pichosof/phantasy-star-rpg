import { z } from 'zod';

/**
 * NPC portraits from an image generator (Fotor). The GM reviews a drafted prompt, the task
 * runs at the provider and its completion webhook (or an explicit check by the GM) stores the
 * picture and makes it the NPC's portrait. Nothing is guessed: a missing profile, a provider
 * failure or a blocked image is reported as such.
 */

/** Profile applied to every portrait (art direction, style references). */
export const STYLE_PROFILE = 'style';
export const MAX_PROMPT = 4000;
export const MAX_REFERENCES = 8;
/** Portrait 3:4, within the generator's pixel limits. */
export const PORTRAIT_SIZE = { width: 1104, height: 1472 } as const;

const reference = z
  .string()
  .trim()
  .refine((u) => u.startsWith('/files/') || /^https:\/\/\S+$/.test(u), {
    message: 'A reference must be an uploaded file (/files/...) or an https URL',
  });

export const profileKey = z.string().trim().min(1).max(40);

export const savePortraitProfileInput = z.object({
  prompt: z.string().trim().min(1).max(MAX_PROMPT),
  references: z.array(reference).max(MAX_REFERENCES),
});

export const generatePortraitInput = z.object({
  /** Race profile used for the draft (kept for the history); null when the GM wrote it all. */
  profile: profileKey.nullable(),
  prompt: z.string().trim().min(1).max(MAX_PROMPT),
  references: z.array(reference).max(MAX_REFERENCES),
});

export interface PortraitProfile {
  key: string;
  prompt: string;
  references: string[];
  updatedAt: Date;
}

export type PortraitJobStatus = 'pending' | 'done' | 'failed';

export interface PortraitJob {
  id: number;
  npcId: number;
  taskId: string;
  profile: string | null;
  prompt: string;
  references: string[];
  status: PortraitJobStatus;
  error: string | null;
  imageUrl: string | null;
  imageMime: string | null;
  imageSize: number | null;
  createdAt: Date;
  finishedAt: Date | null;
}

export interface PortraitNpc {
  id: number;
  name: string;
  role: string | null;
  location: string | null;
  description: string | null;
  race: string | null;
  imageUrl: string | null;
}

export interface PortraitProfileRepository {
  list(): Promise<PortraitProfile[]>;
  get(key: string): Promise<PortraitProfile | null>;
  save(key: string, data: { prompt: string; references: string[] }): Promise<PortraitProfile>;
  delete(key: string): Promise<boolean>;
}

export interface PortraitJobRepository {
  create(data: {
    npcId: number;
    taskId: string;
    profile: string | null;
    prompt: string;
    references: string[];
  }): Promise<PortraitJob>;
  get(id: number): Promise<PortraitJob | null>;
  findByTask(taskId: string): Promise<PortraitJob | null>;
  listByNpc(npcId: number): Promise<PortraitJob[]>;
  complete(id: number, image: StoredImage): Promise<PortraitJob>;
  fail(id: number, error: string): Promise<PortraitJob>;
  delete(id: number): Promise<void>;
}

export interface PortraitNpcs {
  find(id: number): Promise<PortraitNpc | null>;
  setImage(id: number, image: StoredImage): Promise<void>;
}

export interface StoredImage {
  url: string;
  mime: string;
  size: number;
}

export type GeneratorTaskState =
  | { state: 'pending' }
  | { state: 'done'; resultUrl: string }
  | { state: 'failed'; reason: string };

export interface PortraitGenerator {
  readonly enabled: boolean;
  /** Starts a task; references are site URLs (`/files/...`) or https URLs. */
  submit(input: {
    prompt: string;
    references: string[];
    width: number;
    height: number;
  }): Promise<string>;
  status(taskId: string): Promise<GeneratorTaskState>;
  /** Downloads a finished result. */
  fetchResult(resultUrl: string): Promise<{ data: Buffer; mime: string }>;
}

export interface PortraitFiles {
  save(npcId: number, data: Buffer, mime: string): Promise<StoredImage>;
  delete(url: string): Promise<void>;
}

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export class PortraitsDisabledError extends HttpError {
  constructor() {
    super(503, 'NPC portraits are not configured (FOTOR_API_KEY).');
  }
}

async function requireNpc(npcs: PortraitNpcs, id: number) {
  const npc = await npcs.find(id);
  if (!npc) throw new HttpError(404, `NPC ${id} not found`);
  return npc;
}

async function requireJob(jobs: PortraitJobRepository, id: number) {
  const job = await jobs.get(id);
  if (!job) throw new HttpError(404, `Portrait ${id} not found`);
  return job;
}

// ── Profiles ──

export class ListPortraitProfiles {
  constructor(private profiles: PortraitProfileRepository) {}
  execute() {
    return this.profiles.list();
  }
}

export class SavePortraitProfile {
  constructor(private profiles: PortraitProfileRepository) {}
  execute(key: string, input: unknown) {
    const data = savePortraitProfileInput.parse(input);
    return this.profiles.save(profileKey.parse(key), data);
  }
}

export class DeletePortraitProfile {
  constructor(private profiles: PortraitProfileRepository) {}
  async execute(key: string) {
    if (!(await this.profiles.delete(key)))
      throw new HttpError(404, `Portrait profile "${key}" not found`);
  }
}

// ── Draft ──

/** NPC text for the prompt: Markdown removed, GM-only quotes (secrets) left out. */
export function npcPortraitText(npc: PortraitNpc): string {
  const head = [npc.name, npc.role, npc.location].filter(Boolean).join(' — ');
  const body = (npc.description ?? '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('>'))
    .join('\n')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, name: string, label?: string) =>
      (label ?? name.replace(/^\w+:/, '')).trim(),
    )
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[*_#`]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  return body ? `${head}\n${body}` : head;
}

export function composePortraitPrompt(
  npc: PortraitNpc,
  race: PortraitProfile,
  style: PortraitProfile,
) {
  return [
    `Portrait of one character: ${npcPortraitText(npc)}`,
    `Species and anatomy: ${race.prompt}`,
    `Art direction: ${style.prompt}`,
  ].join('\n\n');
}

/** The prompt and references the GM reviews before generating. */
export class DraftNpcPortrait {
  constructor(
    private npcs: PortraitNpcs,
    private profiles: PortraitProfileRepository,
  ) {}

  async execute(npcId: number, profile: string | null) {
    const npc = await requireNpc(this.npcs, npcId);
    const key = profile ?? npc.race;
    if (!key)
      throw new HttpError(400, `${npc.name} has no race: pick the portrait profile to use.`);
    if (key === STYLE_PROFILE) throw new HttpError(400, 'Pick a race profile, not the style.');
    const style = await this.profiles.get(STYLE_PROFILE);
    if (!style) throw new HttpError(409, 'Set up the portrait style first (profile "style").');
    const race = await this.profiles.get(key);
    if (!race)
      throw new HttpError(409, `There is no portrait profile "${key}" yet: create it first.`);
    return {
      profile: key,
      prompt: composePortraitPrompt(npc, race, style),
      references: [...style.references, ...race.references],
    };
  }
}

// ── Generation ──

export class GenerateNpcPortrait {
  constructor(
    private npcs: PortraitNpcs,
    private jobs: PortraitJobRepository,
    private generator: PortraitGenerator,
  ) {}

  get enabled() {
    return this.generator.enabled;
  }

  async execute(npcId: number, input: unknown) {
    if (!this.generator.enabled) throw new PortraitsDisabledError();
    const data = generatePortraitInput.parse(input);
    await requireNpc(this.npcs, npcId);
    const running = (await this.jobs.listByNpc(npcId)).find((j) => j.status === 'pending');
    if (running) throw new HttpError(409, 'A portrait for this NPC is still being generated.');
    const taskId = await this.generator.submit({
      prompt: data.prompt,
      references: data.references,
      ...PORTRAIT_SIZE,
    });
    return this.jobs.create({ npcId, taskId, ...data });
  }
}

export class ListNpcPortraits {
  constructor(
    private npcs: PortraitNpcs,
    private jobs: PortraitJobRepository,
  ) {}
  async execute(npcId: number) {
    await requireNpc(this.npcs, npcId);
    return this.jobs.listByNpc(npcId);
  }
}

/**
 * Asks the provider how a task went and records it: the finished picture is stored and becomes
 * the NPC's portrait. Driven by the webhook (which only says "look at task X") and by the GM's
 * explicit check, so the provider's answer is the only source of truth. A job that failed while
 * storing the result can be checked again without paying for a new image.
 */
export class CompletePortraitJob {
  private running = new Map<string, Promise<PortraitJob | null>>();

  constructor(
    private jobs: PortraitJobRepository,
    private npcs: PortraitNpcs,
    private generator: PortraitGenerator,
    private files: PortraitFiles,
  ) {}

  /** Null when the task is not ours (webhooks fire for every task of the account). */
  execute(taskId: string): Promise<PortraitJob | null> {
    const current = this.running.get(taskId);
    if (current) return current;
    const run = this.run(taskId).finally(() => this.running.delete(taskId));
    this.running.set(taskId, run);
    return run;
  }

  private async run(taskId: string) {
    const job = await this.jobs.findByTask(taskId);
    if (!job || job.status === 'done') return job;
    if (!this.generator.enabled) throw new PortraitsDisabledError();

    const task = await this.generator.status(taskId);
    if (task.state === 'pending') return job;
    if (task.state === 'failed') return this.jobs.fail(job.id, task.reason);

    let image: StoredImage;
    try {
      const { data, mime } = await this.generator.fetchResult(task.resultUrl);
      image = await this.files.save(job.npcId, data, mime);
    } catch (e) {
      return this.jobs.fail(
        job.id,
        `The image was generated but could not be stored: ${(e as Error).message}`,
      );
    }
    const done = await this.jobs.complete(job.id, image);
    await this.npcs.setImage(job.npcId, image);
    return done;
  }
}

/** The GM's "check now": asks the provider about a pending or failed job. */
export class CheckPortraitJob {
  constructor(
    private jobs: PortraitJobRepository,
    private complete: CompletePortraitJob,
  ) {}
  async execute(jobId: number) {
    const job = await requireJob(this.jobs, jobId);
    return (await this.complete.execute(job.taskId)) ?? job;
  }
}

/** Makes an earlier generated picture the NPC's portrait again. */
export class ApplyPortrait {
  constructor(
    private jobs: PortraitJobRepository,
    private npcs: PortraitNpcs,
  ) {}
  async execute(jobId: number) {
    const job = await requireJob(this.jobs, jobId);
    if (job.status !== 'done' || !job.imageUrl || !job.imageMime || job.imageSize === null)
      throw new HttpError(409, 'Only a finished portrait can be used.');
    await this.npcs.setImage(job.npcId, {
      url: job.imageUrl,
      mime: job.imageMime,
      size: job.imageSize,
    });
  }
}

/** Discards a generated picture (not the NPC's current portrait, nor a running task). */
export class DeletePortraitJob {
  constructor(
    private jobs: PortraitJobRepository,
    private npcs: PortraitNpcs,
    private files: PortraitFiles,
  ) {}
  async execute(jobId: number) {
    const job = await requireJob(this.jobs, jobId);
    if (job.status === 'pending')
      throw new HttpError(409, 'This portrait is still being generated.');
    if (job.imageUrl) {
      const npc = await this.npcs.find(job.npcId);
      if (npc?.imageUrl === job.imageUrl)
        throw new HttpError(409, 'This picture is the current portrait: use another one first.');
      await this.files.delete(job.imageUrl);
    }
    await this.jobs.delete(jobId);
  }
}
