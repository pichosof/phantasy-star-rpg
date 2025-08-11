import { z } from 'zod';

import type { CityDrizzleRepository } from '../../../infra/repositories/city.drizzle.repository';
import { City } from '../../entities/city';

export const createCityInput = z.object({
  name: z.string().min(1),
  region: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});
export type CreateCityInput = z.input<typeof createCityInput>;

export class CreateCity {
  constructor(private repo: CityDrizzleRepository) {}
  async execute(i: CreateCityInput) {
    const d = createCityInput.parse(i);
    return this.repo.create(City.create(d));
  }
}
