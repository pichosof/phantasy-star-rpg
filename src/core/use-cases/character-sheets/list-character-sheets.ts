import type { CharacterSheet } from '../../entities/character-sheet.js';

export class ListCharacterSheets {
  constructor(private repo: { list(type?: string): Promise<CharacterSheet[]> }) {}
  execute(type?: string) { return this.repo.list(type); }
}
