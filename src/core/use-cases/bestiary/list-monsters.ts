import type { MonsterDrizzleRepository } from '../../../infra/repositories/monster.drizzle.repository';
export class ListMonsters {
  constructor(private repo: MonsterDrizzleRepository) {}
  async execute() {
    return this.repo.list();
  }
}
