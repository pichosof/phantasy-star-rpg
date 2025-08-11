import { z } from 'zod';
import { IQuestRepository } from '../repositories/quest.repository';

export const completeQuestInput = z.object({
  id: z.number().int().positive(),
});

export class CompleteQuest {
  constructor(private repo: IQuestRepository) {}
  async execute(input: { id: number }) {
    const data = completeQuestInput.parse(input);
    await this.repo.complete(data.id);
  }
}
