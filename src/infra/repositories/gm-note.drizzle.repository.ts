import { desc, eq, like } from 'drizzle-orm';
import { GmNote } from '../../core/entities/gm-note.js';
import { db, schema } from '../db/index.js';

type Row = typeof schema.gmNotes.$inferSelect;

const map = (r: Row): GmNote =>
  GmNote.rehydrate({
    id: r.id,
    title: r.title,
    content: r.content,
    tags: r.tags,
    pinned: r.pinned,
    createdAt: r.createdAt ? new Date(r.createdAt) : null,
    updatedAt: r.updatedAt ? new Date(r.updatedAt) : null,
  });

export class GmNoteDrizzleRepository {
  async create(n: GmNote): Promise<GmNote> {
    const [r] = await db
      .insert(schema.gmNotes)
      .values({
        title: n.props.title,
        content: n.props.content ?? null,
        tags: n.props.tags ?? null,
        pinned: n.props.pinned ?? false,
      })
      .returning();
    return map(r);
  }

  async list(tag?: string): Promise<GmNote[]> {
    const rows = await db
      .select()
      .from(schema.gmNotes)
      .orderBy(desc(schema.gmNotes.pinned), desc(schema.gmNotes.updatedAt));
    const all = rows.map(map);
    if (!tag) return all;
    const t = tag.toLowerCase();
    return all.filter((n) =>
      (n.props.tags ?? '').split(',').map((s) => s.trim().toLowerCase()).includes(t),
    );
  }

  async update(id: number, data: Partial<{ title: string; content: string | null; tags: string | null; pinned: boolean }>): Promise<void> {
    await db
      .update(schema.gmNotes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.gmNotes.id, id));
  }

  async delete(id: number): Promise<void> {
    await db.delete(schema.gmNotes).where(eq(schema.gmNotes.id, id));
  }
}
