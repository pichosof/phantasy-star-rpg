import type { FastifyReply, FastifyRequest } from 'fastify';

import type { CreateTimelineEventInput } from '../../../core/use-cases/timeline/create-timeline-event.js';
import { container } from '../../../di/container.js';

export class TimelineController {
  async list(req: FastifyRequest, reply: FastifyReply) {
    return reply.send(await container.resolve('listTimelineEvents').execute());
  }
  async create(req: FastifyRequest<{ Body: CreateTimelineEventInput }>, reply: FastifyReply) {
    const res = await container.resolve('createTimelineEvent').execute(req.body);
    return reply.code(201).send(res);
  }
  
  async delete(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    await container.resolve('deleteTimelineEvent').execute({ id: Number(req.params.id) });
    return reply.code(204).send();
  }
}
