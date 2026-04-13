import type { z } from 'zod';

import { createTimelineEventInput } from './create-timeline-event';

export const updateTimelineEventInput = createTimelineEventInput.partial();
export type UpdateTimelineEventInput = z.infer<typeof updateTimelineEventInput>;

export class UpdateTimelineEvent {
  constructor(
    private repo: {
      update(id: number, data: UpdateTimelineEventInput): Promise<void>;
    },
  ) {}

  execute(id: number, data: UpdateTimelineEventInput) {
    return this.repo.update(id, updateTimelineEventInput.parse(data));
  }
}
