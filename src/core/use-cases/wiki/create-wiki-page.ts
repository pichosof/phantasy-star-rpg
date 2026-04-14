import { z } from 'zod';

import { WikiPage } from '../../entities/wiki-page.js';

export const createWikiPageInput = z.object({
  title: z.string().min(1),
  category: z.string().nullish(),
  content: z.string().nullish(),
  pinned: z.boolean().optional(),
  visible: z.boolean().optional(),
});
export type CreateWikiPageInput = z.infer<typeof createWikiPageInput>;

export class CreateWikiPage {
  constructor(private repo: { create(p: WikiPage): Promise<WikiPage> }) {}
  execute(input: CreateWikiPageInput) {
    const parsed = createWikiPageInput.parse(input);
    const page = WikiPage.create(parsed);
    return this.repo.create(page);
  }
}
