import { Player } from "../entities/player";

export interface IPlayerRepository {
  create(player: Player): Promise<Player>;
  list(): Promise<Player[]>;
}
