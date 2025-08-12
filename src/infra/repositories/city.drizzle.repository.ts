import { eq } from 'drizzle-orm';

import { City } from '../../core/entities/city.js';
import { db, schema } from '../db/index.js';
type Row = typeof schema.cities.$inferSelect;
const map = (r: Row) => City.rehydrate(r);

export class CityDrizzleRepository {
  async create(c: City) {
    const [r] = await db
      .insert(schema.cities)
      .values({
        name: c.props.name,
        region: c.props.region ?? null,
        description: c.props.description ?? null,
        discovered: !!c.props.discovered,
      })
      .returning();
    return map(r);
  }

  async list() {
    const rows = await db.select().from(schema.cities).orderBy(schema.cities.id);
    return rows.map(map);
  }

  async setDiscovered(id: number, discovered: boolean) {
    await db.update(schema.cities).set({ discovered: discovered }).where(eq(schema.cities.id, id));
  }

  async delete(id: number) {
    await db.delete(schema.cities).where(eq(schema.cities.id, id));
  }

  async setWorld(cityId: number, worldId: number | null) {
    await db
      .update(schema.cities)
      .set({ worldId, updatedAt: new Date() })
      .where(eq(schema.cities.id, cityId));
  }
}
