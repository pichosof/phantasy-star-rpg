import type { z } from 'zod';

import { createGmNoteInput } from './create-gm-note.js';

export const updateGmNoteInput = createGmNoteInput.partial();
export type UpdateGmNoteInput = z.infer<typeof updateGmNoteInput>;

export class UpdateGmNote {
  constructor(private repo: { update(id: number, data: UpdateGmNoteInput): Promise<void> }) {}
  execute(id: number, data: UpdateGmNoteInput) {
    return this.repo.update(id, updateGmNoteInput.parse(data));
  }
}
