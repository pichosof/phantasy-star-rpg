import { z } from 'zod';

export const PlayerModel = z.object({
  id: z.number(),
  name: z.string(),
  level: z.number(),
  background: z.string().nullable(),
  createdAt: z.string().datetime().or(z.string()), // se vier string simples
  updatedAt: z.string().datetime().or(z.string()),
});

export const PlayersModel = z.array(PlayerModel);

// helpers
export const ok = <T extends z.ZodTypeAny>(schema: T) => ({ 200: schema });
export const created = <T extends z.ZodTypeAny>(schema: T) => ({ 201: schema });
