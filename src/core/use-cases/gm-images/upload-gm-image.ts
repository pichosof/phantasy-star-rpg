import type { GmImage } from '../../entities/gm-image.js';
import { GmImage as GmImageEntity } from '../../entities/gm-image.js';

export interface UploadGmImageInput {
  filename: string;
  url: string;
  alt?: string | null;
  mime: string;
  size: number;
}

export class UploadGmImage {
  constructor(private repo: { create(img: GmImage): Promise<GmImage> }) {}
  execute(input: UploadGmImageInput) {
    const img = GmImageEntity.create(input);
    return this.repo.create(img);
  }
}
