import { z } from 'zod';

import type { MonsterDrizzleRepository } from '../../../infra/repositories/monster.drizzle.repository';
const delIn = z.object({ id: z.number().int().positive() });
export class DeleteMonster {
  constructor(private repo: MonsterDrizzleRepository) {}
  async execute(i: { id: number }) {
    await this.repo.delete(delIn.parse(i).id);
  }
}
