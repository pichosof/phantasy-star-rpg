import type { FastifyReply, FastifyRequest } from 'fastify';
import { container } from '../../../di/container';

type Params = { id: string };

export class CityLinksController {
  private isGM(req: FastifyRequest) {
    const raw = req.raw.headers as Record<string, unknown>;
  const header = raw['x-api-key'] ?? (req.headers as any)['x-api-key'];

  const apiKey = Array.isArray(header) ? header[0] : header;
  const apiKeyNorm = (apiKey ?? '').toString().trim();

  const envRaw = (process.env.GM_API_KEYS ?? process.env.GM_API_KEY ?? '').trim();
  const validKeys = envRaw.split(',').map((k) => k.trim()).filter(Boolean);

  return validKeys.length > 0 && validKeys.includes(apiKeyNorm);
  }

  listLoresByCityId = async (req: FastifyRequest<{ Params: Params }>, reply: FastifyReply) => {
    const cityId = Number(req.params.id);
    if (!Number.isInteger(cityId) || cityId <= 0) {
      return reply.code(400).send({ message: 'invalid_city_id' });
    }

    const uc = container.resolve('listLoresByCityId');
    const items = await uc.execute(cityId, { includeHidden: this.isGM(req) });
    return reply.send(items);
  };

  listQuestsByCityId = async (req: FastifyRequest<{ Params: Params }>, reply: FastifyReply) => {
    const cityId = Number(req.params.id);
    if (!Number.isInteger(cityId) || cityId <= 0) {
      return reply.code(400).send({ message: 'invalid_city_id' });
    }
 
    const uc = container.resolve('listQuestsByCityId') as {
        execute: (cityId: number, opts?: { includeHidden?: boolean }) => Promise<any[]>;
        };

    const items = await uc.execute(cityId, { includeHidden: this.isGM(req) });
    return reply.send(items);
  };
}
