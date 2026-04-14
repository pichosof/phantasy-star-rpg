import fsp from 'node:fs/promises';
import path from 'node:path';
import type { GmImage } from '../../entities/gm-image.js';

export class DeleteGmImage {
  constructor(private repo: { findById(id: number): Promise<GmImage | null>; delete(id: number): Promise<void> }) {}

  async execute(id: number) {
    const img = await this.repo.findById(id);
    if (!img) return;
    // Remove physical file (url like /files/gm/images/xxx.jpg)
    const rel = img.props.url.replace(/^\/files\//, '');
    const filePath = path.resolve('data', 'uploads', rel);
    await fsp.rm(filePath, { force: true });
    await this.repo.delete(id);
  }
}
