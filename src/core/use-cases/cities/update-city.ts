import type { z } from 'zod';

import { createCityInput } from './create-city';

export const updateCityInput = createCityInput.partial();

export class UpdateCity {
  constructor(
    private repo: { update(id: number, data: z.infer<typeof updateCityInput>): Promise<void> },
  ) {}
  execute(id: number, data: z.infer<typeof updateCityInput>) {
    return this.repo.update(id, data);
  }
}
