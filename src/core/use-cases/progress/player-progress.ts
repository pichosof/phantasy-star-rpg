import { z } from 'zod';

export interface ProgressEntry {
  id: number;
  playerId: number;
  sessionId: number | null;
  /** Null for players when the session is hidden. */
  sessionTitle: string | null;
  sessionDate: string | null;
  xp: number;
  credits: number;
  note: string | null;
  createdAt: Date | null;
}

export interface ProgressRepository {
  /** Player visibility (null = player does not exist). */
  playerVisible(playerId: number): Promise<boolean | null>;
  sessionExists(sessionId: number): Promise<boolean>;
  existingPlayerIds(ids: number[]): Promise<number[]>;
  listByPlayer(
    playerId: number,
  ): Promise<Array<ProgressEntry & { sessionVisible: boolean | null }>>;
  listBySession(sessionId: number): Promise<ProgressEntry[]>;
  /** Replaces every entry of the session in one transaction. */
  replaceSession(
    sessionId: number,
    rewards: Array<{ playerId: number; xp: number; credits: number; note: string | null }>,
  ): Promise<void>;
}

export class ProgressNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(what: string) {
    super(`${what} not found`);
  }
}

const amount = z.number().int().min(-1_000_000).max(1_000_000);

export const sessionRewardsInput = z.object({
  rewards: z
    .array(
      z.object({
        playerId: z.number().int().positive(),
        xp: amount.default(0),
        credits: amount.default(0),
        note: z.string().trim().max(300).nullish(),
      }),
    )
    .max(50),
});

/** Progress of one player; players only see visible players and titles of visible sessions. */
export class GetPlayerProgress {
  constructor(private repo: ProgressRepository) {}
  async execute(playerId: number, gm: boolean) {
    const visible = await this.repo.playerVisible(playerId);
    if (visible === null || (!gm && !visible)) throw new ProgressNotFoundError('Player');
    const entries = (await this.repo.listByPlayer(playerId)).map(({ sessionVisible, ...e }) =>
      gm || sessionVisible ? e : { ...e, sessionTitle: null, sessionDate: null },
    );
    return {
      entries,
      totals: {
        xp: entries.reduce((s, e) => s + e.xp, 0),
        credits: entries.reduce((s, e) => s + e.credits, 0),
      },
    };
  }
}

export class GetSessionRewards {
  constructor(private repo: ProgressRepository) {}
  async execute(sessionId: number) {
    if (!(await this.repo.sessionExists(sessionId))) throw new ProgressNotFoundError('Session');
    return this.repo.listBySession(sessionId);
  }
}

/** Saves the rewards of a session (idempotent: editing replaces the previous award). */
export class SetSessionRewards {
  constructor(private repo: ProgressRepository) {}
  async execute(sessionId: number, input: unknown) {
    const { rewards } = sessionRewardsInput.parse(input);
    if (!(await this.repo.sessionExists(sessionId))) throw new ProgressNotFoundError('Session');
    const ids = [...new Set(rewards.map((r) => r.playerId))];
    if (ids.length !== rewards.length) {
      throw Object.assign(new Error('Each player can appear only once.'), { statusCode: 400 });
    }
    const existing = new Set(await this.repo.existingPlayerIds(ids));
    const missing = ids.filter((id) => !existing.has(id));
    if (missing.length) throw new ProgressNotFoundError(`Player ${missing.join(', ')}`);
    const kept = rewards
      .map((r) => ({ ...r, note: r.note?.trim() || null }))
      .filter((r) => r.xp !== 0 || r.credits !== 0 || r.note);
    await this.repo.replaceSession(sessionId, kept);
    return this.repo.listBySession(sessionId);
  }
}
