import type { WikiPage } from '../../entities/wiki-page.js';

export class ListWikiPages {
  constructor(private repo: { list(): Promise<WikiPage[]> }) {}
  execute() {
    return this.repo.list();
  }
}
