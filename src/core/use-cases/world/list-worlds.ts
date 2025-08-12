import type { World } from '../../entities/world';

export interface IWorldListRepo {
  list(): Promise<World[]>;
}

export class ListWorlds {
  constructor(private repo: IWorldListRepo) {}
  execute() {
    return this.repo.list();
  }
}
