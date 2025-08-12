import type { z } from 'zod';

import { createPlayerInput } from './create-player';

export const updatePlayerInput = createPlayerInput.partial();

export class UpdatePlayer {
  constructor(
    private repo: { update(id: number, data: z.infer<typeof updatePlayerInput>): Promise<void> },
  ) {}
  execute(id: number, data: z.infer<typeof updatePlayerInput>) {
    return this.repo.update(id, data);
  }
}
