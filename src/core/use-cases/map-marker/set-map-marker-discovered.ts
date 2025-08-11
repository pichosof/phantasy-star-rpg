import { z } from 'zod';

import type { MapMarkerDrizzleRepository } from '../../../infra/repositories/map-marker.drizzle.repository';
const input = z.object({ id: z.number().int().positive(), discovered: z.boolean() });
export class SetMapMarkerDiscovered {
  constructor(private repo: MapMarkerDrizzleRepository) {}
  async execute(i: { id: number; discovered: boolean }) {
    const d = input.parse(i);
    await this.repo.setDiscovered(d.id, d.discovered);
  }
}
