import { z } from 'zod';

export const MAX_NOTES = 20_000;

export const saveDiaryInput = z.object({ notes: z.string().max(MAX_NOTES) });
export const summarizeDiaryInput = z.object({ notes: z.string().trim().min(1).max(MAX_NOTES) });

export interface SessionDiaryRepository {
  sessionTitle(sessionId: number): Promise<string | null>;
  get(sessionId: number): Promise<{ notes: string; updatedAt: Date | null }>;
  save(sessionId: number, notes: string): Promise<void>;
}

export interface DiarySummarizer {
  readonly enabled: boolean;
  /** Returns Markdown. `names` are entity names the summary may link as [[Name]]. */
  summarize(input: { sessionTitle: string; notes: string; names: string[] }): Promise<string>;
}

export class SessionNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(id: number) {
    super(`Session ${id} not found`);
  }
}

export class AiDisabledError extends Error {
  readonly statusCode = 503;
  constructor() {
    super('AI summaries are not configured (ANTHROPIC_API_KEY).');
  }
}

async function requireSession(repo: SessionDiaryRepository, id: number) {
  const title = await repo.sessionTitle(id);
  if (title === null) throw new SessionNotFoundError(id);
  return title;
}

export class GetSessionDiary {
  constructor(private repo: SessionDiaryRepository) {}
  async execute(sessionId: number) {
    await requireSession(this.repo, sessionId);
    return this.repo.get(sessionId);
  }
}

export class SaveSessionDiary {
  constructor(private repo: SessionDiaryRepository) {}
  async execute(sessionId: number, input: unknown) {
    const { notes } = saveDiaryInput.parse(input);
    await requireSession(this.repo, sessionId);
    await this.repo.save(sessionId, notes);
    return { notes };
  }
}

/** AI summary of the GM's notes; the GM reviews it before it becomes the session summary. */
export class SummarizeSessionDiary {
  constructor(
    private repo: SessionDiaryRepository,
    private summarizer: DiarySummarizer,
    private listNames: () => Promise<string[]>,
  ) {}

  get enabled() {
    return this.summarizer.enabled;
  }

  async execute(sessionId: number, input: unknown) {
    if (!this.summarizer.enabled) throw new AiDisabledError();
    const { notes } = summarizeDiaryInput.parse(input);
    const sessionTitle = await requireSession(this.repo, sessionId);
    const names = (await this.listNames()).slice(0, 600);
    const markdown = await this.summarizer.summarize({ sessionTitle, notes, names });
    return { markdown };
  }
}
