import type { Quest } from '../../entities/quest';

export class ListQuests {
  constructor(private repo: { list(): Promise<Quest[]> }) {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  execute(_params: { includeHidden: boolean }) {
    return this.repo.list();
  }
}
