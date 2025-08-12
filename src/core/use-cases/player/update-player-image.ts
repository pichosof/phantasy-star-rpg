export class UpdatePlayerImage {
  constructor(
    private repo: {
      updateImage(
        id: number,
        data: { url: string; alt?: string | null; mime?: string | null; size?: number | null },
      ): Promise<void>;
    },
  ) {}
  execute(
    id: number,
    data: { url: string; alt?: string | null; mime?: string | null; size?: number | null },
  ) {
    return this.repo.updateImage(id, data);
  }
}
