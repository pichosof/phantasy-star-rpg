import { z } from 'zod';

export const PlayerModel = z.object({
  id: z.number(),
  name: z.string(),
  level: z.number(),
  background: z.string().nullable(),
  createdAt: z.string(), // mantenha string simples
  updatedAt: z.string(),
});

export const PlayersModel = z.array(PlayerModel);
