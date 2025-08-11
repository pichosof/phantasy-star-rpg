import { z } from 'zod';

import type { CityDrizzleRepository } from '../../../infra/repositories/city.drizzle.repository';
const delIn = z.object({ id: z.number().int().positive() });
export class DeleteCity {
  constructor(private repo: CityDrizzleRepository) {}
  async execute(i: { id: number }) {
    await this.repo.delete(delIn.parse(i).id);
  }
}
