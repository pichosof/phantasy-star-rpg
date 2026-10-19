import { asc, eq, inArray } from 'drizzle-orm';

import type { ProgressRepository } from '../../core/use-cases/progress/player-progress.js';
import { db, schema as s } from '../db/index.js';

const columns = {
  id: s.playerProgress.id,
  playerId: s.playerProgress.playerId,
  sessionId: s.playerProgress.sessionId,
  sessionTitle: s.sessions.title,
  sessionDate: s.sessions.date,
  sessionVisible: s.sessions.visible,
  xp: s.playerProgress.xp,
  credits: s.playerProgress.credits,
  note: s.playerProgress.note,
  createdAt: s.playerProgress.createdAt,
};

export class ProgressDrizzleRepository implements ProgressRepository {
  async playerVisible(playerId: number) {
    const [r] = await db
      .select({ visible: s.players.visible })
      .from(s.players)
      .where(eq(s.players.id, playerId));
    return r ? r.visible : null;
  }

  async sessionExists(sessionId: number) {
    const [r] = await db
      .select({ id: s.sessions.id })
      .from(s.sessions)
      .where(eq(s.sessions.id, sessionId));
    return Boolean(r);
  }

  async existingPlayerIds(ids: number[]) {
    if (!ids.length) return [];
    const rows = await db
      .select({ id: s.players.id })
      .from(s.players)
      .where(inArray(s.players.id, ids));
    return rows.map((r) => r.id);
  }

  async listByPlayer(playerId: number) {
    return db
      .select(columns)
      .from(s.playerProgress)
      .leftJoin(s.sessions, eq(s.playerProgress.sessionId, s.sessions.id))
      .where(eq(s.playerProgress.playerId, playerId))
      .orderBy(asc(s.playerProgress.sessionId), asc(s.playerProgress.id));
  }

  async listBySession(sessionId: number) {
    const rows = await db
      .select(columns)
      .from(s.playerProgress)
      .leftJoin(s.sessions, eq(s.playerProgress.sessionId, s.sessions.id))
      .where(eq(s.playerProgress.sessionId, sessionId))
      .orderBy(asc(s.playerProgress.playerId));
    return rows.map((r) => {
      const { sessionVisible, ...rest } = r;
      void sessionVisible;
      return rest;
    });
  }

  async replaceSession(
    sessionId: number,
    rewards: Array<{ playerId: number; xp: number; credits: number; note: string | null }>,
  ) {
    db.transaction((tx) => {
      tx.delete(s.playerProgress).where(eq(s.playerProgress.sessionId, sessionId)).run();
      if (rewards.length) {
        tx.insert(s.playerProgress)
          .values(rewards.map((r) => ({ ...r, sessionId })))
          .run();
      }
    });
  }
}
