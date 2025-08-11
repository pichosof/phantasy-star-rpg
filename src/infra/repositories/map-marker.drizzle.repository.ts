import { eq } from 'drizzle-orm';

import { MapMarker } from '../../core/entities/map-marker.js';
import { db, schema } from '../db/index.js';
type Row = typeof schema.mapMarkers.$inferSelect;
const map = (r: Row) =>
  MapMarker.rehydrate({
    id: r.id,
    name: r.name,
    type: r.type ?? null, // <-- explicita null
    coordinates: r.coordinates ?? null,
    description: r.description ?? null,
    discovered: r.discovered,
    createdAt: r.createdAt,
  });

export class MapMarkerDrizzleRepository {
  async create(m: MapMarker) {
    const [r] = await db
      .insert(schema.mapMarkers)
      .values({
        name: m.props.name,
        type: m.props.type,
        coordinates: m.props.coordinates ?? null,
        description: m.props.description ?? null,
        discovered: !!m.props.discovered,
      })
      .returning();
    return map(r);
  }

  async list() {
    const rows = await db.select().from(schema.mapMarkers).orderBy(schema.mapMarkers.id);
    return rows.map(map);
  }

  async setDiscovered(id: number, discovered: boolean) {
    await db
      .update(schema.mapMarkers)
      .set({ discovered: discovered })
      .where(eq(schema.mapMarkers.id, id));
  }

  async delete(id: number) {
    await db.delete(schema.mapMarkers).where(eq(schema.mapMarkers.id, id));
  }
}
