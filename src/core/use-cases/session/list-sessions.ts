import type { SessionDrizzleRepository } from '../../../infra/repositories/session.drizzle.repository';
export class ListSessions {
  constructor(private repo: SessionDrizzleRepository) {}
  async execute() {
    return this.repo.list();
  }
}
