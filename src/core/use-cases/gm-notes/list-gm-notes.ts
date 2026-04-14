import type { GmNote } from '../../entities/gm-note.js';

export class ListGmNotes {
  constructor(private repo: { list(tag?: string): Promise<GmNote[]> }) {}
  execute(tag?: string) { return this.repo.list(tag); }
}
