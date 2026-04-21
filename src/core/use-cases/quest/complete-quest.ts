import { z } from 'zod';

export const completeQuestInput = z.object({
  id: z.number().int().positive(),
});

export class CompleteQuest {
  constructor(private repo: { complete(id: number): Promise<void> }) {}
  async execute(input: { id: number }) {
    const data = completeQuestInput.parse(input);
    await this.repo.complete(data.id);
  }
}
