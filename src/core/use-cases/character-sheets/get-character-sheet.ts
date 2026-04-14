import type { CharacterSheet } from '../../entities/character-sheet.js';

export class GetCharacterSheet {
  constructor(private repo: { findById(id: number): Promise<CharacterSheet | null> }) {}
  execute(id: number) { return this.repo.findById(id); }
}
