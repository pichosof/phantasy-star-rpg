import { z } from 'zod';

import { CharacterSheet } from '../../entities/character-sheet.js';

export const createSheetInput = z.object({
  type: z.enum(['gurps', 'starfinder']),
  name: z.string().min(1),
  data: z.record(z.unknown()).optional().default({}),
});
export type CreateSheetInput = z.infer<typeof createSheetInput>;

export class CreateCharacterSheet {
  constructor(private repo: { create(s: CharacterSheet): Promise<CharacterSheet> }) {}
  execute(input: CreateSheetInput) {
    const parsed = createSheetInput.parse(input);
    const sheet = CharacterSheet.create(parsed);
    return this.repo.create(sheet);
  }
}
