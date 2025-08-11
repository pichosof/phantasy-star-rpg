import type { LoreDrizzleRepository } from '../../../infra/repositories/lore.drizzle.repository';
export class ListLores {
  constructor(private repo: LoreDrizzleRepository) {}
  async execute() {
    return this.repo.list();
  }
}
