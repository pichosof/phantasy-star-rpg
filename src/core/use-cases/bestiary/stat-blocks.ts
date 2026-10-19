import { z } from 'zod';

/** One Starfinder stat block (a life stage / variant of a bestiary entry). GM-only data. */
export const statBlockSchema = z.object({
  label: z.string().trim().min(1).max(80),
  cr: z.string().trim().min(1).max(10),
  xp: z.number().int().min(0).nullish(),
  size: z.string().max(40).nullish(),
  type: z.string().max(120).nullish(),
  initiative: z.number().int().min(-20).max(60),
  senses: z.string().max(300).nullish(),
  hp: z.number().int().min(0).max(99999),
  sp: z.number().int().min(0).max(99999).nullish(),
  rp: z.number().int().min(0).max(999).nullish(),
  eac: z.number().int().min(0).max(99),
  kac: z.number().int().min(0).max(99),
  fort: z.number().int().min(-20).max(60).nullish(),
  ref: z.number().int().min(-20).max(60).nullish(),
  will: z.number().int().min(-20).max(60).nullish(),
  speed: z.string().max(200).nullish(),
  attacks: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        bonus: z.number().int().min(-20).max(80).nullish(),
        damage: z.string().max(200).nullish(),
      }),
    )
    .max(12),
  abilities: z
    .array(z.object({ name: z.string().trim().min(1).max(120), text: z.string().max(600) }))
    .max(20),
  skills: z.string().max(300).nullish(),
  mods: z.record(z.string(), z.number().int().min(-10).max(20).nullable()).nullish(),
  source: z.string().max(300).nullish(),
});
export const statBlocksSchema = z.array(statBlockSchema).max(20);

export type StatBlock = z.infer<typeof statBlockSchema>;

export interface StatBlockRepository {
  listAll(): Promise<Array<{ monsterId: number; blocks: StatBlock[] }>>;
  replace(monsterId: number, blocks: StatBlock[]): Promise<void>;
  monsterExists(monsterId: number): Promise<boolean>;
}

export class MonsterNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(id: number) {
    super(`Bestiary entry ${id} not found`);
  }
}

export class ListStatBlocks {
  constructor(private repo: StatBlockRepository) {}
  execute() {
    return this.repo.listAll();
  }
}

export class SetStatBlocks {
  constructor(private repo: StatBlockRepository) {}
  async execute(monsterId: number, blocks: unknown) {
    const parsed = statBlocksSchema.parse(blocks);
    if (!(await this.repo.monsterExists(monsterId))) throw new MonsterNotFoundError(monsterId);
    await this.repo.replace(monsterId, parsed);
    return { monsterId, blocks: parsed };
  }
}
