import type { MapMarkerDrizzleRepository } from '../../../infra/repositories/map-marker.drizzle.repository';
export class ListMapMarkers {
  constructor(private repo: MapMarkerDrizzleRepository) {}
  async execute() {
    return this.repo.list();
  }
}
