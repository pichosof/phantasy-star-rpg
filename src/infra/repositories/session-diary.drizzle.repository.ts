import { eq } from 'drizzle-orm';

import type { SessionDiaryRepository } from '../../core/use-cases/session-diary/session-diary.js';
import { db, schema } from '../db/index.js';

export class SessionDiaryDrizzleRepository implements SessionDiaryRepository {
  async sessionTitle(sessionId: number) {
    const [r] = await db
      .select({ title: schema.sessions.title })
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId));
    return r?.title ?? null;
  }

  async get(sessionId: number) {
    const [r] = await db
      .select()
      .from(schema.sessionDiaries)
      .where(eq(schema.sessionDiaries.sessionId, sessionId));
    return { notes: r?.notes ?? '', updatedAt: r?.updatedAt ?? null };
  }

  async save(sessionId: number, notes: string) {
    const values = { sessionId, notes, updatedAt: new Date() };
    await db
      .insert(schema.sessionDiaries)
      .values(values)
      .onConflictDoUpdate({ target: schema.sessionDiaries.sessionId, set: values });
  }
}
