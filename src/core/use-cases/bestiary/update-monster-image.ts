import { z } from 'zod';

import type { MonsterDrizzleRepository } from '../../../infra/repositories/monster.drizzle.repository';
export const updateMonsterImageInput = z.object({
  id: z.number().int().positive(),
  url: z.string().min(1),
  alt: z.string().nullable().optional(),
  mime: z.string().nullable().optional(),
  size: z.number().int().nullable().optional(),
});
export class UpdateMonsterImage {
  constructor(private repo: MonsterDrizzleRepository) {}
  async execute(i: z.infer<typeof updateMonsterImageInput>) {
    const d = updateMonsterImageInput.parse(i);
    await this.repo.updateImage(d.id, {
      url: d.url,
      alt: d.alt ?? undefined,
      mime: d.mime ?? undefined,
      size: d.size ?? undefined,
    });
  }
}
