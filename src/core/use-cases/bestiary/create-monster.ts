import { z } from 'zod';

import type { MonsterDrizzleRepository } from '../../../infra/repositories/monster.drizzle.repository';
import { Monster } from '../../entities/monster';

export const createMonsterInput = z.object({
  name: z.string().min(1),
  type: z.string().nullable().optional(),
  habitat: z.string().nullable().optional(),
  weaknesses: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});
export type CreateMonsterInput = z.input<typeof createMonsterInput>;

export class CreateMonster {
  constructor(private repo: MonsterDrizzleRepository) {}
  async execute(i: CreateMonsterInput) {
    const d = createMonsterInput.parse(i);
    return this.repo.create(Monster.create(d));
  }
}
