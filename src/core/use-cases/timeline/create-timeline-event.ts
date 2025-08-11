import { z } from 'zod';

import type { TimelineDrizzleRepository } from '../../../infra/repositories/timeline.drizzle.repository';
import { TimelineEvent } from '../../entities/timeline-event';

export const createTimelineEventInput = z.object({
  title: z.string().min(1),
  date: z.string().min(1),
  description: z.string().nullable().optional(),
});
export type CreateTimelineEventInput = z.input<typeof createTimelineEventInput>;

export class CreateTimelineEvent {
  constructor(private repo: TimelineDrizzleRepository) {}
  async execute(i: CreateTimelineEventInput) {
    const d = createTimelineEventInput.parse(i);
    return this.repo.create(TimelineEvent.create(d));
  }
}
