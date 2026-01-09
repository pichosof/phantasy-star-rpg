import { z } from 'zod';

export const updateQuestInput = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  reward: z.string().nullable().optional(),
  status: z.enum(['active', 'completed', 'failed']).optional(),
});
export type UpdateQuestInput = z.input<typeof updateQuestInput>;

export class UpdateQuest {
  constructor(
    private repo: {
      update(
        id: number,
        data: {
          title?: string;
          description?: string | null;
          reward?: string | null;
          status?: 'active' | 'completed' | 'failed';
        },
      ): Promise<void>;
    },
  ) {}

  async execute(id: number, data: UpdateQuestInput) {
    const d = updateQuestInput.parse(data);
    await this.repo.update(id, d);
  }
}
