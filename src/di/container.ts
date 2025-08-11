import { PlayerDrizzleRepository } from "../infra/repositories/player.drizzle.repository.js";
import { CreatePlayer } from "../core/use-cases/create-player.js";
import { ListPlayers } from "../core/use-cases/list-players.js";
import { QuestDrizzleRepository } from "../infra/repositories/quest.drizzle.repository.js";
import { CreateQuest } from "../core/use-cases/create-quest.js";
import { ListQuests } from "../core/use-cases/list-quests.js";
import { CompleteQuest } from "../core/use-cases/complete-quest.js";

type Registry = {
  playerRepo: PlayerDrizzleRepository;
  createPlayer: CreatePlayer;
  listPlayers: ListPlayers;
  questRepo: QuestDrizzleRepository;
  createQuest: CreateQuest;
  listQuests: ListQuests;
  completeQuest: CompleteQuest;
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
      case "questRepo": {
        const repo = new QuestDrizzleRepository();
        this.singletons.set(key, repo);
        return repo as any;
      }
      case "createQuest": {
        const uc = new CreateQuest(this.resolve("questRepo"));
        this.singletons.set(key, uc);
        return uc as any;
      }
      case "listQuests": {
        const uc = new ListQuests(this.resolve("questRepo"));
        this.singletons.set(key, uc);
        return uc as any;
      }
      case "completeQuest": {
        const uc = new CompleteQuest(this.resolve("questRepo"));
        this.singletons.set(key, uc);
        return uc as any;
      }
      default:
        throw new Error(`Unknown dependency: ${String(key)}`);
    }
  }
}

export const container = new Container();
