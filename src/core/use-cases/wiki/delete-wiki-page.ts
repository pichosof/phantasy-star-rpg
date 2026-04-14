export class DeleteWikiPage {
  constructor(private repo: { delete(id: number): Promise<void> }) {}
  execute(id: number) {
    return this.repo.delete(id);
  }
}
