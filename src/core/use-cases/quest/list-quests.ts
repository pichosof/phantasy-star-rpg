import type { Quest } from '../../entities/quest';

export class ListQuests {
  constructor(private repo: { list(): Promise<Quest[]> }) {}
  execute(p0: { includeHidden: boolean; }) {
    return this.repo.list();
  }
}
