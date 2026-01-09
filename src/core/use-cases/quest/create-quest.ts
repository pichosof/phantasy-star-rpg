import { z } from 'zod';
import { Quest } from '../../entities/quest';

export const createQuestInput = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  reward: z.string().nullable().optional(),
});
export type CreateQuestInput = z.input<typeof createQuestInput>;

export class CreateQuest {
  constructor(private repo: { create(q: Quest): Promise<Quest> }) {}
  async execute(i: CreateQuestInput) {
    const d = createQuestInput.parse(i);
    return this.repo.create(Quest.create(d));
  }
}
