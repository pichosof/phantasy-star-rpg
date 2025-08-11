import type { IQuestRepository } from '../../repositories/quest.repository';

export class ListQuests {
  constructor(private repo: IQuestRepository) {}
  async execute() {
    return this.repo.list();
  }
}
