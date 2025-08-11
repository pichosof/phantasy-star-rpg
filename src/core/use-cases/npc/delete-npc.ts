import { z } from 'zod';

import type { NpcDrizzleRepository } from '../../../infra/repositories/npc.drizzle.repository';
const input = z.object({ id: z.number().int().positive() });
export class DeleteNpc {
  constructor(private repo: NpcDrizzleRepository) {}
  async execute(i: { id: number }) {
    await this.repo.delete(input.parse(i).id);
  }
}
