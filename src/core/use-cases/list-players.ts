import { IPlayerRepository } from "../repositories/player.repository";

export class ListPlayers {
  constructor(private repo: IPlayerRepository) {}
  async execute() {
    return this.repo.list();
  }
}
