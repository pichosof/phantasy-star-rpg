import { z } from 'zod';

import type { LoreDrizzleRepository } from '../../../infra/repositories/lore.drizzle.repository';
const input = z.object({ id: z.number().int().positive() });
export class DeleteLore {
  constructor(private repo: LoreDrizzleRepository) {}
  async execute(i: { id: number }) {
    await this.repo.delete(input.parse(i).id);
  }
}
