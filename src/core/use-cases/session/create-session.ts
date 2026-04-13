import { z } from 'zod';

import type { SessionDrizzleRepository } from '../../../infra/repositories/session.drizzle.repository';
import { Session } from '../../entities/session';

export const createSessionInput = z.object({
  title: z.string().min(1),
  date: z.string().min(1),
  summary: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  imageAlt: z.string().nullable().optional(),
});
export type CreateSessionInput = z.input<typeof createSessionInput>;

export class CreateSession {
  constructor(private repo: SessionDrizzleRepository) {}
  async execute(i: CreateSessionInput) {
    const d = createSessionInput.parse(i);
    return this.repo.create(Session.create(d));
  }
}
