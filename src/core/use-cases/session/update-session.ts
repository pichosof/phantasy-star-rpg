import { z } from 'zod';

import { createSessionInput } from './create-session';

export const updateSessionInput = createSessionInput.partial().extend({
  visible: z.boolean().optional(),
});

export class UpdateSession {
  constructor(
    private repo: {
      update(id: number, data: z.infer<typeof updateSessionInput>): Promise<void>;
    },
  ) {}

  execute(id: number, data: z.infer<typeof updateSessionInput>) {
    return this.repo.update(id, data);
  }
}
