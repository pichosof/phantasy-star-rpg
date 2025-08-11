import type { TimelineDrizzleRepository } from '../../../infra/repositories/timeline.drizzle.repository';
export class ListTimelineEvents {
  constructor(private repo: TimelineDrizzleRepository) {}
  async execute() {
    return this.repo.list();
  }
}
