import { and, asc, eq } from 'drizzle-orm';

import type { Item, ItemInput, ItemRepository } from '../../core/use-cases/items/items.js';
import { db, schema } from '../db/index.js';

type Row = typeof schema.items.$inferSelect;

const parseList = (v: string | null): string[] => {
  try {
    const x = JSON.parse(v ?? '[]');
    return Array.isArray(x) ? x.map(String) : [];
  } catch {
    return [];
  }
};

const map = (r: Row): Item => ({
  id: r.id,
  code: r.code,
  name: r.name,
  localName: r.localName,
  origin: r.origin as Item['origin'],
  kind: r.kind,
  group: r.group,
  category: r.category,
  level: r.level,
  damage: r.damage,
  unit: r.unit,
  region: r.region as Item['region'],
  description: r.description,
  rules: r.rules,
  sourceUrl: r.sourceUrl,
  localPrice: r.localPrice,
  availabilityNote: r.availabilityNote,
  refPrice: r.refPrice,
  access: r.access as Item['access'],
  channel: r.channel,
  tags: parseList(r.tags),
  shops: parseList(r.shops),
  loot: parseList(r.loot),
  policies: r.policies,
  flags: r.flags,
  gmNotes: r.gmNotes,
  audit: r.audit ? (JSON.parse(r.audit) as Record<string, string>) : null,
  visibility: r.visibility as Item['visibility'],
  status: r.status as Item['status'],
  createdAt: r.createdAt ? new Date(r.createdAt) : null,
  updatedAt: r.updatedAt ? new Date(r.updatedAt) : null,
});

/** Columns from domain fields (JSON-encoded lists and audit). */
function toRow(data: Partial<ItemInput>) {
  const { tags, shops, loot, audit, ...rest } = data;
  return {
    ...rest,
    ...(tags !== undefined && { tags: JSON.stringify(tags) }),
    ...(shops !== undefined && { shops: JSON.stringify(shops) }),
    ...(loot !== undefined && { loot: JSON.stringify(loot) }),
    ...(audit !== undefined && { audit: audit ? JSON.stringify(audit) : null }),
  };
}

export class ItemDrizzleRepository implements ItemRepository {
  async list({ playerView }: { playerView: boolean }): Promise<Item[]> {
    const t = schema.items;
    const rows = await db
      .select()
      .from(t)
      .where(playerView ? and(eq(t.visibility, 'public'), eq(t.status, 'published')) : undefined)
      .orderBy(asc(t.code));
    return rows.map(map);
  }

  async get(id: number): Promise<Item | null> {
    const [r] = await db.select().from(schema.items).where(eq(schema.items.id, id));
    return r ? map(r) : null;
  }

  async create(input: ItemInput): Promise<Item> {
    const [r] = await db
      .insert(schema.items)
      .values(toRow(input) as typeof schema.items.$inferInsert)
      .returning();
    return map(r);
  }

  async update(id: number, data: Partial<ItemInput>): Promise<Item | null> {
    const [r] = await db
      .update(schema.items)
      .set({ ...toRow(data), updatedAt: new Date() })
      .where(eq(schema.items.id, id))
      .returning();
    return r ? map(r) : null;
  }

  async delete(id: number): Promise<boolean> {
    const res = await db.delete(schema.items).where(eq(schema.items.id, id)).returning();
    return res.length > 0;
  }

  async upsertMany(rows: ItemInput[]) {
    let created = 0;
    let updated = 0;
    db.transaction((tx) => {
      for (const input of rows) {
        const values = toRow(input) as typeof schema.items.$inferInsert;
        const existing = tx
          .select({ id: schema.items.id })
          .from(schema.items)
          .where(eq(schema.items.code, input.code))
          .get();
        if (existing) {
          tx.update(schema.items)
            .set({ ...values, updatedAt: new Date() })
            .where(eq(schema.items.id, existing.id))
            .run();
          updated += 1;
        } else {
          tx.insert(schema.items).values(values).run();
          created += 1;
        }
      }
    });
    return { created, updated };
  }
}
