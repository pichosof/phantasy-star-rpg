import { z } from 'zod';

import type { TimelineDrizzleRepository } from '../../../infra/repositories/timeline.drizzle.repository';
const delIn = z.object({ id: z.number().int().positive() });
export class DeleteTimelineEvent {
  constructor(private repo: TimelineDrizzleRepository) {}
  async execute(i: { id: number }) {
    await this.repo.delete(delIn.parse(i).id);
  }
}
