import { z } from 'zod';

import type { NpcDrizzleRepository } from '../../../infra/repositories/npc.drizzle.repository';
import { Npc } from '../../entities/npc';

export const createNpcInput = z.object({
  name: z.string().min(1),
  role: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
});
export type CreateNpcInput = z.input<typeof createNpcInput>;

export class CreateNpc {
  constructor(private repo: NpcDrizzleRepository) {}
  async execute(input: CreateNpcInput) {
    const data = createNpcInput.parse(input);
    return this.repo.create(Npc.create(data));
  }
}
