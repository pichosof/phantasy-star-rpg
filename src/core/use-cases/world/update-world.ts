import type { z } from 'zod';

import { createWorldInput } from './create-world';

export const updateWorldInput = createWorldInput.partial();

export class UpdateWorld {
  constructor(
    private repo: { update(id: number, data: z.infer<typeof updateWorldInput>): Promise<void> },
  ) {}
  execute(id: number, data: z.infer<typeof updateWorldInput>) {
    return this.repo.update(id, data);
  }
}
