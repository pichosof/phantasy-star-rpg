import { deleteStoredFileByUrl } from '../../../infra/storage/index.js';
import type { GmImage } from '../../entities/gm-image.js';

export class DeleteGmImage {
  constructor(
    private repo: {
      findById(id: number): Promise<GmImage | null>;
      delete(id: number): Promise<void>;
    },
  ) {}

  async execute(id: number) {
    const img = await this.repo.findById(id);
    if (!img) return;
    await deleteStoredFileByUrl(img.props.url);
    await this.repo.delete(id);
  }
}
