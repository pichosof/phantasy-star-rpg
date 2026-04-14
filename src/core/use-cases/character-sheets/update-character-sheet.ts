import { z } from 'zod';

export const updateSheetInput = z.object({
  name: z.string().min(1).optional(),
  data: z.record(z.unknown()).optional(),
});
export type UpdateSheetInput = z.infer<typeof updateSheetInput>;

export class UpdateCharacterSheet {
  constructor(private repo: { update(id: number, data: UpdateSheetInput): Promise<void> }) {}
  execute(id: number, data: UpdateSheetInput) {
    return this.repo.update(id, updateSheetInput.parse(data));
  }
}
