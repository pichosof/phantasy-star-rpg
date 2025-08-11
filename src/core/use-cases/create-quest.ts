import { z } from 'zod';
import { IQuestRepository } from '../repositories/quest.repository';
import { Quest } from '../entities/quest';

export const createQuestInput = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  reward: z.string().nullable().optional(),
});

export type CreateQuestInput = z.infer<typeof createQuestInput>;

export class CreateQuest {
  constructor(private repo: IQuestRepository) {}
  async execute(input: CreateQuestInput) {
    const data = createQuestInput.parse(input);
    const q = Quest.create(data);
    return this.repo.create(q);
  }
}
