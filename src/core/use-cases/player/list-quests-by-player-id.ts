import type { LinksDrizzleRepository } from '../../../infra/repositories/links.drizzle.repository';

export class ListQuestsByPlayerId {
  constructor(private readonly linksRepo: LinksDrizzleRepository) {}

  async execute(playerId: number, opts: { includeHidden: boolean }) {
    return this.linksRepo.listQuestsByPlayerId(playerId, opts);
  }
}
