import { z } from 'zod';

import type { NpcDrizzleRepository } from '../../../infra/repositories/npc.drizzle.repository';

export const updateNpcImageInput = z.object({
  id: z.number().int().positive(),
  url: z.string().min(1),
  alt: z.string().nullable().optional(),
  mime: z.string().nullable().optional(),
  size: z.number().int().nullable().optional(),
});
export type UpdateNpcImageInput = z.infer<typeof updateNpcImageInput>;

export class UpdateNpcImage {
  constructor(private repo: NpcDrizzleRepository) {}
  async execute(input: UpdateNpcImageInput) {
    const data = updateNpcImageInput.parse(input);
    await this.repo.updateImage(data.id, {
      url: data.url,
      alt: data.alt ?? undefined,
      mime: data.mime ?? undefined,
      size: data.size ?? undefined,
    });
  }
}
