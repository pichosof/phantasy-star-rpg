import type { FastifyReply, FastifyRequest } from 'fastify';

import type { CreateTimelineEventInput } from '../../../core/use-cases/timeline/create-timeline-event.js';
import type { UpdateTimelineEventInput } from '../../../core/use-cases/timeline/update-timeline-event.js';
import { container } from '../../../di/container.js';

type CreateTimelineBodyCompat = CreateTimelineEventInput & {
  occurredAt?: string;
  date?: string;
};

export class TimelineController {
  async list(req: FastifyRequest, reply: FastifyReply) {
    return reply.send(await container.resolve('listTimelineEvents').execute());
  }

  async create(req: FastifyRequest<{ Body: CreateTimelineBodyCompat }>, reply: FastifyReply) {
    const b = req.body ?? ({} as CreateTimelineBodyCompat);
    const input: CreateTimelineEventInput = {
      title: b.title,
      date: b.date ?? b.occurredAt ?? '',
      description: b.description ?? null,
    };
    const res = await container.resolve('createTimelineEvent').execute(input);
    return reply.code(201).send(res);
  }

  async update(
    req: FastifyRequest<{ Params: { id: string }; Body: UpdateTimelineEventInput }>,
    reply: FastifyReply,
  ) {
    await container.resolve('updateTimelineEvent').execute(Number(req.params.id), req.body ?? {});
    return reply.code(204).send();
  }

  async setVisibility(
    req: FastifyRequest<{ Params: { id: string }; Body: { visible: boolean } }>,
    reply: FastifyReply,
  ) {
    await container
      .resolve('setTimelineVisibility')
      .execute(Number(req.params.id), req.body.visible);
    return reply.code(204).send();
  }

  async delete(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    await container.resolve('deleteTimelineEvent').execute({ id: Number(req.params.id) });
    return reply.code(204).send();
  }
}
