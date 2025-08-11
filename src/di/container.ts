import { PlayerDrizzleRepository } from "../infra/repositories/player.drizzle.repository.js";
import { CreatePlayer } from "../core/use-cases/create-player.js";
import { ListPlayers } from "../core/use-cases/list-players.js";

type Registry = {
  playerRepo: PlayerDrizzleRepository;
  createPlayer: CreatePlayer;
  listPlayers: ListPlayers;
};

class Container {
  private singletons = new Map<string, any>();

  resolve<K extends keyof Registry>(key: K): Registry[K] {
    if (this.singletons.has(key)) return this.singletons.get(key);

    switch (key) {
      case "playerRepo": {
        const repo = new PlayerDrizzleRepository();
        this.singletons.set(key, repo);
        return repo as any;
      }
      case "createPlayer": {
        const uc = new CreatePlayer(this.resolve("playerRepo"));
        this.singletons.set(key, uc);
        return uc as any;
      }
      case "listPlayers": {
        const uc = new ListPlayers(this.resolve("playerRepo"));
        this.singletons.set(key, uc);
        return uc as any;
      }
      default:
        throw new Error(`Unknown dependency: ${String(key)}`);
    }
  }
}

export const container = new Container();
