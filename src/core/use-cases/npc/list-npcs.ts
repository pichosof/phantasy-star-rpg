import type { NpcDrizzleRepository } from '../../../infra/repositories/npc.drizzle.repository';
export class ListNpcs {
  constructor(private repo: NpcDrizzleRepository) {}
  async execute() {
    return this.repo.list();
  }
}
