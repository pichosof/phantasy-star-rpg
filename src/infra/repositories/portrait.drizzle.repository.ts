import { randomUUID } from 'node:crypto';

import { desc, eq } from 'drizzle-orm';

import type {
  PortraitFiles,
  PortraitJob,
  PortraitJobRepository,
  PortraitJobStatus,
  PortraitNpc,
  PortraitNpcs,
  PortraitProfile,
  PortraitProfileRepository,
  StoredImage,
} from '../../core/use-cases/portraits/portraits.js';
import { db, schema } from '../db/index.js';
import { deleteStoredFileByUrl, fileStorage } from '../storage/index.js';

const urls = (json: string) => JSON.parse(json) as string[];

type ProfileRow = typeof schema.portraitProfiles.$inferSelect;
const toProfile = (r: ProfileRow): PortraitProfile => ({
  key: r.key,
  prompt: r.prompt,
  references: urls(r.references),
  updatedAt: r.updatedAt,
});

type JobRow = typeof schema.portraitJobs.$inferSelect;
const toJob = (r: JobRow): PortraitJob => ({
  ...r,
  status: r.status as PortraitJobStatus,
  references: urls(r.references),
});

export class PortraitProfileDrizzleRepository implements PortraitProfileRepository {
  async list() {
    const rows = await db
      .select()
      .from(schema.portraitProfiles)
      .orderBy(schema.portraitProfiles.key);
    return rows.map(toProfile);
  }

  async get(key: string) {
    const [row] = await db
      .select()
      .from(schema.portraitProfiles)
      .where(eq(schema.portraitProfiles.key, key));
    return row ? toProfile(row) : null;
  }

  async save(key: string, data: { prompt: string; references: string[] }) {
    const values = {
      prompt: data.prompt,
      references: JSON.stringify(data.references),
      updatedAt: new Date(),
    };
    const [row] = await db
      .insert(schema.portraitProfiles)
      .values({ key, ...values })
      .onConflictDoUpdate({ target: schema.portraitProfiles.key, set: values })
      .returning();
    return toProfile(row);
  }

  async delete(key: string) {
    const rows = await db
      .delete(schema.portraitProfiles)
      .where(eq(schema.portraitProfiles.key, key))
      .returning();
    return rows.length > 0;
  }
}

export class PortraitJobDrizzleRepository implements PortraitJobRepository {
  async create(data: {
    npcId: number;
    taskId: string;
    profile: string | null;
    prompt: string;
    references: string[];
  }) {
    const [row] = await db
      .insert(schema.portraitJobs)
      .values({ ...data, references: JSON.stringify(data.references) })
      .returning();
    return toJob(row);
  }

  async get(id: number) {
    const [row] = await db.select().from(schema.portraitJobs).where(eq(schema.portraitJobs.id, id));
    return row ? toJob(row) : null;
  }

  async findByTask(taskId: string) {
    const [row] = await db
      .select()
      .from(schema.portraitJobs)
      .where(eq(schema.portraitJobs.taskId, taskId));
    return row ? toJob(row) : null;
  }

  async listByNpc(npcId: number) {
    const rows = await db
      .select()
      .from(schema.portraitJobs)
      .where(eq(schema.portraitJobs.npcId, npcId))
      .orderBy(desc(schema.portraitJobs.id));
    return rows.map(toJob);
  }

  private async finish(id: number, set: Partial<typeof schema.portraitJobs.$inferInsert>) {
    const [row] = await db
      .update(schema.portraitJobs)
      .set({ ...set, finishedAt: new Date() })
      .where(eq(schema.portraitJobs.id, id))
      .returning();
    if (!row) throw new Error(`Portrait job ${id} disappeared`);
    return toJob(row);
  }

  complete(id: number, image: StoredImage) {
    return this.finish(id, {
      status: 'done',
      error: null,
      imageUrl: image.url,
      imageMime: image.mime,
      imageSize: image.size,
    });
  }

  fail(id: number, error: string) {
    return this.finish(id, { status: 'failed', error });
  }

  async delete(id: number) {
    await db.delete(schema.portraitJobs).where(eq(schema.portraitJobs.id, id));
  }
}

/** The NPC side of portraits: read for the draft, set the generated picture as the portrait. */
export class PortraitNpcsDrizzle implements PortraitNpcs {
  async find(id: number): Promise<PortraitNpc | null> {
    const [row] = await db.select().from(schema.npcs).where(eq(schema.npcs.id, id));
    if (!row) return null;
    const { name, role, location, description, race, imageUrl } = row;
    return { id, name, role, location, description, race, imageUrl };
  }

  async setImage(id: number, image: StoredImage) {
    await db
      .update(schema.npcs)
      .set({
        imageUrl: image.url,
        imageMime: image.mime,
        imageSize: image.size,
        updatedAt: new Date(),
      })
      .where(eq(schema.npcs.id, id));
  }
}

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export class PortraitStorageFiles implements PortraitFiles {
  async save(npcId: number, data: Buffer, mime: string) {
    const ext = EXT[mime];
    if (!ext) throw new Error(`Unsupported portrait type: ${mime}`);
    const saved = await fileStorage.saveBuffer(data, {
      key: `npcs/portraits/${npcId}-${Date.now()}-${randomUUID()}.${ext}`,
      mime,
    });
    return { url: saved.url, mime, size: saved.size };
  }

  delete(url: string) {
    return deleteStoredFileByUrl(url);
  }
}
