import type { LinksDrizzleRepository } from '../../../infra/repositories/links.drizzle.repository';

export class ListQuestsByCityId {
  constructor(private readonly linksRepo: LinksDrizzleRepository) {}

  async execute(cityId: number, opts?: { includeHidden?: boolean }) {
    return this.linksRepo.listQuestsByCityId(cityId, opts);
  }
}
