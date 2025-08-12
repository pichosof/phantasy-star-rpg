import { z } from 'zod';

import { createQuestInput } from './create-quest';

export const updateQuestInput = createQuestInput.partial().extend({
  status: z.enum(['active', 'completed', 'failed']).optional(),
});

export class UpdateQuest {
  constructor(
    private repo: {
      update(id: number, data: z.infer<typeof updateQuestInput>): Promise<void>;
    },
  ) {}

  execute(id: number, data: z.infer<typeof updateQuestInput>) {
    return this.repo.update(id, data);
  }
}
