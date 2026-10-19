import { eq } from 'drizzle-orm';

import type { StatBlock, StatBlockRepository } from '../../core/use-cases/bestiary/stat-blocks.js';
import { db, schema } from '../db/index.js';

const parse = (raw: string): StatBlock[] => {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

export class StatBlockDrizzleRepository implements StatBlockRepository {
  async listAll() {
    const rows = await db.select().from(schema.monsterStatBlocks);
    return rows.map((r) => ({ monsterId: r.monsterId, blocks: parse(r.blocks) }));
  }

  async replace(monsterId: number, blocks: StatBlock[]) {
    if (!blocks.length) {
      await db
        .delete(schema.monsterStatBlocks)
        .where(eq(schema.monsterStatBlocks.monsterId, monsterId));
      return;
    }
    const values = { monsterId, blocks: JSON.stringify(blocks), updatedAt: new Date() };
    await db
      .insert(schema.monsterStatBlocks)
      .values(values)
      .onConflictDoUpdate({ target: schema.monsterStatBlocks.monsterId, set: values });
  }

  async monsterExists(monsterId: number) {
    const [r] = await db
      .select({ id: schema.bestiary.id })
      .from(schema.bestiary)
      .where(eq(schema.bestiary.id, monsterId));
    return Boolean(r);
  }
}
