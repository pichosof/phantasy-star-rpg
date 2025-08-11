import { eq } from 'drizzle-orm';

import { Session } from '../../core/entities/session.js';
import { db, schema } from '../db/index.js';
type Row = typeof schema.sessions.$inferSelect;
const map = (r: Row) => Session.rehydrate(r);

export class SessionDrizzleRepository {
  async create(s: Session) {
    const [r] = await db
      .insert(schema.sessions)
      .values({
        title: s.props.title,
        date: s.props.date,
        summary: s.props.summary ?? null,
      })
      .returning();
    return map(r);
  }

  async list() {
    const rows = await db.select().from(schema.sessions).orderBy(schema.sessions.id);
    return rows.map(map);
  }

  async delete(id: number) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, id));
  }
}
