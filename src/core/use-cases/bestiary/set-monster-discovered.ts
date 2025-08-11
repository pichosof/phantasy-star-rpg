import { z } from 'zod';

import type { MonsterDrizzleRepository } from '../../../infra/repositories/monster.drizzle.repository';
const input = z.object({ id: z.number().int().positive(), discovered: z.boolean() });
export class SetMonsterDiscovered {
  constructor(private repo: MonsterDrizzleRepository) {}
  async execute(i: { id: number; discovered: boolean }) {
    const d = input.parse(i);
    await this.repo.setDiscovered(d.id, d.discovered);
  }
}
