import { z } from 'zod';

import type { World } from '../../entities/world';

export const createWorldInput = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

export interface IWorldRepo {
  create(p: { name: string; description?: string | null }): Promise<World>;
}

export class CreateWorld {
  constructor(private repo: IWorldRepo) {}
  execute(input: z.infer<typeof createWorldInput>) {
    return this.repo.create(input);
  }
}
