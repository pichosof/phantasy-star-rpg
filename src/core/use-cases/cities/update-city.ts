import type { z } from 'zod';
import { z as zod } from 'zod';

import { createCityInput } from './create-city';

// antes: export const updateCityInput = createCityInput.partial();
export const updateCityInput = createCityInput.partial().extend({
  coordinates: zod.string().nullable().optional(),
  worldId: zod.number().nullable().optional(),
});

export class UpdateCity {
  constructor(
    private repo: { update(id: number, data: z.infer<typeof updateCityInput>): Promise<void> },
  ) {}
  execute(id: number, data: z.infer<typeof updateCityInput>) {
    return this.repo.update(id, data);
  }
}
