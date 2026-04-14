import type { GmImage } from '../../entities/gm-image.js';

export class ListGmImages {
  constructor(private repo: { list(): Promise<GmImage[]> }) {}
  execute() { return this.repo.list(); }
}
