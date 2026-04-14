import { eq } from 'drizzle-orm';

import { WikiPage } from '../../core/entities/wiki-page.js';
import { db, schema } from '../db/index.js';

type Row = typeof schema.wikiPages.$inferSelect;
const map = (r: Row): WikiPage =>
  WikiPage.rehydrate({
    id: r.id,
    title: r.title,
    category: r.category,
    content: r.content,
    pinned: r.pinned,
    visible: r.visible,
    createdAt: r.createdAt ? new Date(r.createdAt) : null,
    updatedAt: r.updatedAt ? new Date(r.updatedAt) : null,
  });

export class WikiPageDrizzleRepository {
  async create(p: WikiPage): Promise<WikiPage> {
    const [r] = await db
      .insert(schema.wikiPages)
      .values({
        title: p.props.title,
        category: p.props.category ?? null,
        content: p.props.content ?? null,
        pinned: p.props.pinned ?? false,
        visible: p.props.visible ?? true,
      })
      .returning();
    return map(r);
  }

  async list(): Promise<WikiPage[]> {
    const rows = await db
      .select()
      .from(schema.wikiPages)
      .orderBy(schema.wikiPages.pinned, schema.wikiPages.category, schema.wikiPages.title);
    return rows.map(map);
  }

  async update(
    id: number,
    data: Partial<{
      title: string;
      category: string | null;
      content: string | null;
      pinned: boolean;
      visible: boolean;
    }>,
  ): Promise<void> {
    await db
      .update(schema.wikiPages)
      .set({
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.pinned !== undefined ? { pinned: data.pinned } : {}),
        ...(data.visible !== undefined ? { visible: data.visible } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.wikiPages.id, id));
  }

  async delete(id: number): Promise<void> {
    await db.delete(schema.wikiPages).where(eq(schema.wikiPages.id, id));
  }

  async setVisibility(id: number, visible: boolean): Promise<void> {
    await db
      .update(schema.wikiPages)
      .set({ visible, updatedAt: new Date() })
      .where(eq(schema.wikiPages.id, id));
  }
}
