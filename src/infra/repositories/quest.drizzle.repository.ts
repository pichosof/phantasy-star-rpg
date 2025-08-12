import { eq } from 'drizzle-orm';

import { Quest } from '../../core/entities/quest.js';
import type { IQuestRepository } from '../../core/repositories/quest.repository.js';
import { db, schema } from '../db/index.js';

export class QuestDrizzleRepository implements IQuestRepository {
  async create(quest: Quest): Promise<Quest> {
    const [row] = await db
      .insert(schema.quests)
      .values({
        title: quest['title'],
        status: quest['status'],
        description: quest['description'] ?? null,
        reward: quest['reward'] ?? null,
      })
      .returning();
    return Quest.rehydrate(row);
  }
  async list(): Promise<Quest[]> {
    const rows = await db.select().from(schema.quests).orderBy(schema.quests.id);
    return rows.map((r) => Quest.rehydrate(r));
  }
  async complete(id: number): Promise<void> {
    await db.update(schema.quests).set({ status: 'completed' }).where(eq(schema.quests.id, id));
  }
  async update(
    id: number,
    data: {
      title?: string;
      description?: string | null;
      reward?: string | null;
      status?: 'active' | 'completed' | 'failed';
    },
  ) {
    await db
      .update(schema.quests)
      .set({
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.reward !== undefined ? { reward: data.reward } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.quests.id, id));
  }
}
