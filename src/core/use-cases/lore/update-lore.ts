import type { z } from 'zod';

import { createLoreInput } from './create-lore';

export const updateLoreInput = createLoreInput.partial();

export class UpdateLore {
  constructor(
    private repo: { update(id: number, data: z.infer<typeof updateLoreInput>): Promise<void> },
  ) {}
  execute(id: number, data: z.infer<typeof updateLoreInput>) {
    return this.repo.update(id, data);
  }
}
