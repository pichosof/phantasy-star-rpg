import type { z } from 'zod';

import type { MonsterDrizzleRepository } from '../../../infra/repositories/monster.drizzle.repository';

import { createMonsterInput } from './create-monster';

export const updateMonsterInput = createMonsterInput.partial();
export type UpdateMonsterInput = z.input<typeof updateMonsterInput>;

export class UpdateMonster {
  constructor(private repo: MonsterDrizzleRepository) {}
  execute(id: number, data: UpdateMonsterInput) {
    const d = updateMonsterInput.parse(data);
    return this.repo.update(id, d);
  }
}
