import { z } from 'zod';

import { GmNote } from '../../entities/gm-note.js';

export const createGmNoteInput = z.object({
  title: z.string().min(1),
  content: z.string().nullish(),
  tags: z.string().nullish(),
  pinned: z.boolean().optional(),
});
export type CreateGmNoteInput = z.infer<typeof createGmNoteInput>;

export class CreateGmNote {
  constructor(private repo: { create(n: GmNote): Promise<GmNote> }) {}
  execute(input: CreateGmNoteInput) {
    const parsed = createGmNoteInput.parse(input);
    const note = GmNote.create(parsed);
    return this.repo.create(note);
  }
}
