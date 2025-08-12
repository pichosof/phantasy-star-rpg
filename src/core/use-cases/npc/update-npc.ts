import type { z } from 'zod';

import { createNpcInput } from './create-npc';

export const updateNpcInput = createNpcInput.partial();

export class UpdateNpc {
  constructor(
    private repo: {
      update(id: number, data: z.infer<typeof updateNpcInput>): Promise<void>;
    },
  ) {}

  execute(id: number, data: z.infer<typeof updateNpcInput>) {
    return this.repo.update(id, data);
  }
}
