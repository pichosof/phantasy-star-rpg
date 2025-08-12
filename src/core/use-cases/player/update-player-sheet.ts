export class UpdatePlayerSheet {
  constructor(
    private repo: {
      updateSheet(
        id: number,
        data: { url: string; mime?: string | null; size?: number | null },
      ): Promise<void>;
    },
  ) {}
  execute(id: number, data: { url: string; mime?: string | null; size?: number | null }) {
    return this.repo.updateSheet(id, data);
  }
}
