import { z } from 'zod';

import type { MapMarkerDrizzleRepository } from '../../../infra/repositories/map-marker.drizzle.repository';
const delIn = z.object({ id: z.number().int().positive() });
export class DeleteMapMarker {
  constructor(private repo: MapMarkerDrizzleRepository) {}
  async execute(i: { id: number }) {
    await this.repo.delete(delIn.parse(i).id);
  }
}
