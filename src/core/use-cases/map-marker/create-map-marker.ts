import { z } from 'zod';

import { mapMarkerTypes } from '../../../infra/db/schema';
import type { MapMarkerDrizzleRepository } from '../../../infra/repositories/map-marker.drizzle.repository';
import { MapMarker } from '../../entities/map-marker';

export const createMapMarkerInput = z.object({
  name: z.string().min(1),
  type: z.enum(mapMarkerTypes).optional(),
  coordinates: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});
export type CreateMapMarkerInput = z.input<typeof createMapMarkerInput>;

export class CreateMapMarker {
  constructor(private repo: MapMarkerDrizzleRepository) {}
  async execute(i: CreateMapMarkerInput) {
    const d = createMapMarkerInput.parse(i);
    return this.repo.create(MapMarker.create(d));
  }
}
