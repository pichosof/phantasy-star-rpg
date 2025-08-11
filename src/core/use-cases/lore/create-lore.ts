import { z } from 'zod';

import { loreCategories } from '../../../infra/db/schema';
import type { LoreDrizzleRepository } from '../../../infra/repositories/lore.drizzle.repository';
import { Lore } from '../../entities/lore';

export const createLoreInput = z.object({
  title: z.string().min(1),
  category: z.enum(loreCategories).nullable().optional(),
  content: z.string().nullable().optional(),
});
export type CreateLoreInput = z.input<typeof createLoreInput>;

export class CreateLore {
  constructor(private repo: LoreDrizzleRepository) {}
  async execute(i: CreateLoreInput) {
    const d = createLoreInput.parse(i);
    return this.repo.create(Lore.create(d));
  }
}
