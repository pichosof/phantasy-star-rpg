import { z } from 'zod';

export const setCityDiscoveredInput = z.object({
  discovered: z.boolean(),
});

export class SetCityDiscovered {
  constructor(private repo: { setDiscovered(id: number, discovered: boolean): Promise<void> }) {}

  async execute({ id, discovered }: { id: number; discovered: boolean }) {
    return this.repo.setDiscovered(id, discovered);
  }
}
