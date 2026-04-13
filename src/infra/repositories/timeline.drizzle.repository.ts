import { eq } from 'drizzle-orm';

import { TimelineEvent } from '../../core/entities/timeline-event.js';
import { db, schema } from '../db/index.js';
type Row = typeof schema.timelineEvents.$inferSelect;
const map = (r: Row) => TimelineEvent.rehydrate(r);

export class TimelineDrizzleRepository {
  async create(t: TimelineEvent) {
    const [r] = await db
      .insert(schema.timelineEvents)
      .values({
        title: t.props.title,
        date: t.props.date,
        description: t.props.description ?? null,
      })
      .returning();
    return map(r);
  }
  async setVisibility(id: number, visible: boolean) {
    await db.update(schema.timelineEvents).set({ visible }).where(eq(schema.timelineEvents.id, id));
  }
  async list() {
    const rows = await db.select().from(schema.timelineEvents).orderBy(schema.timelineEvents.id);
    return rows.map(map);
  }

  async update(id: number, data: { title?: string; date?: string; description?: string | null }) {
    await db
      .update(schema.timelineEvents)
      .set({
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.date !== undefined ? { date: data.date } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      })
      .where(eq(schema.timelineEvents.id, id));
  }

  async delete(id: number) {
    await db.delete(schema.timelineEvents).where(eq(schema.timelineEvents.id, id));
  }
}
