import type { z } from 'zod';

import { createWikiPageInput } from './create-wiki-page.js';

export const updateWikiPageInput = createWikiPageInput.partial();
export type UpdateWikiPageInput = z.infer<typeof updateWikiPageInput>;

export class UpdateWikiPage {
  constructor(private repo: { update(id: number, data: UpdateWikiPageInput): Promise<void> }) {}
  execute(id: number, data: UpdateWikiPageInput) {
    return this.repo.update(id, updateWikiPageInput.parse(data));
  }
}
