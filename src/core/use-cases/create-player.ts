import { z } from 'zod';
import { Player } from '../entities/player';
import { IPlayerRepository } from '../repositories/player.repository';

export const createPlayerInput = z.object({
  name: z.string().min(1),
  level: z.number().int().min(1).default(1),
  background: z.string().nullable().optional(),
});

export type CreatePlayerInput = z.input<typeof createPlayerInput>;
export type CreatePlayerData = z.output<typeof createPlayerInput>;

export class CreatePlayer {
  constructor(private repo: IPlayerRepository) {}

  async execute(input: CreatePlayerInput) {
    const data: CreatePlayerData = createPlayerInput.parse(input);
    const player = Player.create(data); // ok: level preenchido
    return this.repo.create(player);
  }
}
