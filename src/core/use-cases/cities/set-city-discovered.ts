import { z } from 'zod';

import type { CityDrizzleRepository } from '../../../infra/repositories/city.drizzle.repository';
const input = z.object({ id: z.number().int().positive(), discovered: z.boolean() });
export class SetCityDiscovered {
  constructor(private repo: CityDrizzleRepository) {}
  async execute(i: { id: number; discovered: boolean }) {
    const d = input.parse(i);
    await this.repo.setDiscovered(d.id, d.discovered);
  }
}
