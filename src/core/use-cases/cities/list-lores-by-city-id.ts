import type { LinksDrizzleRepository } from '../../../infra/repositories/links.drizzle.repository';

export class ListLoresByCityId {
  constructor(private readonly linksRepo: LinksDrizzleRepository) {}

  async execute(cityId: number, opts?: { includeHidden?: boolean }) {
    return this.linksRepo.listLoresByCityId(cityId, opts);
  }
}
