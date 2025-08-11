import { z } from 'zod';

import type { SessionDrizzleRepository } from '../../../infra/repositories/session.drizzle.repository';
const input = z.object({ id: z.number().int().positive() });
export class DeleteSession {
  constructor(private repo: SessionDrizzleRepository) {}
  async execute(i: { id: number }) {
    await this.repo.delete(input.parse(i).id);
  }
}
