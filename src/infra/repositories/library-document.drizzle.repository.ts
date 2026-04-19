import { desc, eq } from 'drizzle-orm';

import { LibraryDocument } from '../../core/entities/library-document.js';
import { db, schema } from '../db/index.js';

type Row = typeof schema.libraryDocuments.$inferSelect;

const map = (r: Row): LibraryDocument =>
  LibraryDocument.rehydrate({
    id: r.id,
    title: r.title,
    description: r.description ?? null,
    category: r.category ?? null,
    filename: r.filename,
    originalName: r.originalName,
    url: r.url,
    mime: r.mime,
    size: r.size,
    visible: r.visible,
    createdAt: r.createdAt ? new Date(r.createdAt) : null,
    updatedAt: r.updatedAt ? new Date(r.updatedAt) : null,
  });

export class LibraryDocumentRepository {
  async create(doc: LibraryDocument): Promise<LibraryDocument> {
    const [r] = await db
      .insert(schema.libraryDocuments)
      .values({
        title: doc.props.title,
        description: doc.props.description ?? null,
        category: doc.props.category ?? null,
        filename: doc.props.filename,
        originalName: doc.props.originalName,
        url: doc.props.url,
        mime: doc.props.mime,
        size: doc.props.size,
        visible: doc.props.visible ?? true,
      })
      .returning();
    return map(r);
  }

  async list(): Promise<LibraryDocument[]> {
    const rows = await db
      .select()
      .from(schema.libraryDocuments)
      .orderBy(desc(schema.libraryDocuments.createdAt));
    return rows.map(map);
  }

  async findById(id: number): Promise<LibraryDocument | null> {
    const [r] = await db
      .select()
      .from(schema.libraryDocuments)
      .where(eq(schema.libraryDocuments.id, id));
    return r ? map(r) : null;
  }

  async update(
    id: number,
    data: {
      title?: string;
      description?: string | null;
      category?: string | null;
      visible?: boolean;
    },
  ): Promise<void> {
    await db
      .update(schema.libraryDocuments)
      .set({
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.visible !== undefined ? { visible: data.visible } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.libraryDocuments.id, id));
  }

  async delete(id: number): Promise<void> {
    await db.delete(schema.libraryDocuments).where(eq(schema.libraryDocuments.id, id));
  }

  // Settings helpers
  async getPlayerKey(): Promise<string | null> {
    const [row] = await db
      .select()
      .from(schema.librarySettings)
      .where(eq(schema.librarySettings.id, 1));
    return row?.playerKey ?? null;
  }

  async setPlayerKey(key: string | null): Promise<void> {
    await db
      .insert(schema.librarySettings)
      .values({ id: 1, playerKey: key, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.librarySettings.id,
        set: { playerKey: key, updatedAt: new Date() },
      });
  }
}
