import { z } from 'zod';

// MODELOS (respostas) – usa os campos que você expõe
export const PlayerModel = z.object({
  id: z.number(),
  name: z.string(),
  level: z.number(),
  background: z.string().nullable(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});
export const PlayersModel = z.array(PlayerModel);

// (faça similares para NPC, Monster, City, etc., quando for usando na rota)

// Pequenos helpers pra Swagger + validação com Zod
export const ok = <T extends z.ZodTypeAny>(schema: T) => ({ 200: schema });
export const created = <T extends z.ZodTypeAny>(schema: T) => ({ 201: schema });
