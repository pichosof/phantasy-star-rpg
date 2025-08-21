import { CreateMonster } from '../core/use-cases/bestiary/create-monster';
import { DeleteMonster } from '../core/use-cases/bestiary/delete-monster';
import { ListMonsters } from '../core/use-cases/bestiary/list-monsters';
import { SetMonsterDiscovered } from '../core/use-cases/bestiary/set-monster-discovered';
import { UpdateMonsterImage } from '../core/use-cases/bestiary/update-monster-image';
import { AssignCityToWorld } from '../core/use-cases/cities/assign-city-to-world';
import { CreateCity } from '../core/use-cases/cities/create-city';
import { DeleteCity } from '../core/use-cases/cities/delete-city';
import { ListCities } from '../core/use-cases/cities/list-cities';
import { RemoveCityFromWorld } from '../core/use-cases/cities/remove-city-from-world';
import { SetCityDiscovered } from '../core/use-cases/cities/set-city-discovered';
import { UpdateCity } from '../core/use-cases/cities/update-city';
import { SetVisibility } from '../core/use-cases/common/set-visibility';
import { CreateLore } from '../core/use-cases/lore/create-lore';
import { DeleteLore } from '../core/use-cases/lore/delete-lore';
import { LinkLoreToCity } from '../core/use-cases/lore/link-lore-to-city';
import { ListLores } from '../core/use-cases/lore/list-lores';
import { UnlinkLoreFromCity } from '../core/use-cases/lore/unlink-lore-from-city';
import { UpdateLore } from '../core/use-cases/lore/update-lore';
import { CreateMapMarker } from '../core/use-cases/map-marker/create-map-marker';
import { DeleteMapMarker } from '../core/use-cases/map-marker/delete-map-marker';
import { ListMapMarkers } from '../core/use-cases/map-marker/list-map-markers';
import { SetMapMarkerDiscovered } from '../core/use-cases/map-marker/set-map-marker-discovered';
import { CreateNpc } from '../core/use-cases/npc/create-npc';
import { DeleteNpc } from '../core/use-cases/npc/delete-npc';
import { ListNpcs } from '../core/use-cases/npc/list-npcs';
import { UpdateNpc } from '../core/use-cases/npc/update-npc';
import { UpdateNpcImage } from '../core/use-cases/npc/update-npc-image';
import { AssignQuestToPlayer } from '../core/use-cases/player/assign-quest-to-player';
import { CreatePlayer } from '../core/use-cases/player/create-player';
import { ListPlayers } from '../core/use-cases/player/list-players';
import { SetPlayerQuestStatus } from '../core/use-cases/player/set-player-quest-status';
import { UpdatePlayer } from '../core/use-cases/player/update-player';
import { UpdatePlayerImage } from '../core/use-cases/player/update-player-image';
import { UpdatePlayerSheet } from '../core/use-cases/player/update-player-sheet';
import { CompleteQuest } from '../core/use-cases/quest/complete-quest';
import { CreateQuest } from '../core/use-cases/quest/create-quest';
import { LinkQuestToCity } from '../core/use-cases/quest/link-quest-to-city';
import { ListQuests } from '../core/use-cases/quest/list-quests';
import { UnlinkQuestFromCity } from '../core/use-cases/quest/unlink-quest-from-city';
import { UpdateQuest } from '../core/use-cases/quest/update-quest';
import { CreateSession } from '../core/use-cases/session/create-session';
import { DeleteSession } from '../core/use-cases/session/delete-session';
import { ListSessions } from '../core/use-cases/session/list-sessions';
import { UpdateSession } from '../core/use-cases/session/update-session';
import { CreateTimelineEvent } from '../core/use-cases/timeline/create-timeline-event';
import { DeleteTimelineEvent } from '../core/use-cases/timeline/delete-timeline-event';
import { ListTimelineEvents } from '../core/use-cases/timeline/list-timeline-events';
import { CreateWorld } from '../core/use-cases/world/create-world';
import { ListWorlds } from '../core/use-cases/world/list-worlds';
import { UpdateWorld } from '../core/use-cases/world/update-world';
import { UpdateWorldImage } from '../core/use-cases/world/update-world-image';
import { CityDrizzleRepository } from '../infra/repositories/city.drizzle.repository';
import { LinksDrizzleRepository } from '../infra/repositories/links.drizzle.repository';
import { LoreDrizzleRepository } from '../infra/repositories/lore.drizzle.repository';
import { MapMarkerDrizzleRepository } from '../infra/repositories/map-marker.drizzle.repository';
import { MonsterDrizzleRepository } from '../infra/repositories/monster.drizzle.repository';
import { NpcDrizzleRepository } from '../infra/repositories/npc.drizzle.repository';
import { PlayerDrizzleRepository } from '../infra/repositories/player.drizzle.repository';
import { QuestDrizzleRepository } from '../infra/repositories/quest.drizzle.repository';
import { SessionDrizzleRepository } from '../infra/repositories/session.drizzle.repository';
import { TimelineDrizzleRepository } from '../infra/repositories/timeline.drizzle.repository';
import { WorldDrizzleRepository } from '../infra/repositories/world.drizzle.repository';


// ----- Tipos do container
export type Registry = {
  // Player
  playerRepo: PlayerDrizzleRepository;
  createPlayer: CreatePlayer;
  listPlayers: ListPlayers;
  updatePlayer: UpdatePlayer;
  updatePlayerImage: UpdatePlayerImage;
  updatePlayerSheet: UpdatePlayerSheet;
  setPlayerVisibility: SetVisibility;

  // Quest
  questRepo: QuestDrizzleRepository;
  createQuest: CreateQuest;
  listQuests: ListQuests;
  completeQuest: CompleteQuest;
  updateQuest: UpdateQuest;

  // NPC
  npcRepo: NpcDrizzleRepository;
  createNpc: CreateNpc;
  listNpcs: ListNpcs;
  deleteNpc: DeleteNpc;
  updateNpcImage: UpdateNpcImage;
  updateNpc: UpdateNpc;
  setNpcVisibility: SetVisibility;

  // Sessions
  sessionRepo: SessionDrizzleRepository;
  createSession: CreateSession;
  listSessions: ListSessions;
  deleteSession: DeleteSession;
  updateSession: UpdateSession;

  // Lore
  loreRepo: LoreDrizzleRepository;
  createLore: CreateLore;
  listLores: ListLores;
  deleteLore: DeleteLore;
  updateLore: UpdateLore;
  setLoreVisibility: SetVisibility;

  // Cities
  cityRepo: CityDrizzleRepository;
  createCity: CreateCity;
  listCities: ListCities;
  setCityDiscovered: SetCityDiscovered;
  deleteCity: DeleteCity;
  updateCity: UpdateCity;
  setCityVisibility: SetVisibility;

  // Bestiary
  monsterRepo: MonsterDrizzleRepository;
  createMonster: CreateMonster;
  listMonsters: ListMonsters;
  setMonsterDiscovered: SetMonsterDiscovered;
  updateMonsterImage: UpdateMonsterImage;
  deleteMonster: DeleteMonster;
  setMonsterVisibility: SetVisibility;

  // Map Markers
  mapMarkerRepo: MapMarkerDrizzleRepository;
  createMapMarker: CreateMapMarker;
  listMapMarkers: ListMapMarkers;
  setMapMarkerDiscovered: SetMapMarkerDiscovered;
  deleteMapMarker: DeleteMapMarker;
  setMapMarkerVisibility: SetVisibility;

  // Timeline
  timelineRepo: TimelineDrizzleRepository;
  createTimelineEvent: CreateTimelineEvent;
  listTimelineEvents: ListTimelineEvents;
  deleteTimelineEvent: DeleteTimelineEvent;
  setTimelineVisibility: SetVisibility;

  // Worlds
  worldRepo: WorldDrizzleRepository;
  createWorld: CreateWorld;
  listWorlds: ListWorlds;
  updateWorldImage: UpdateWorldImage;
  updateWorld: UpdateWorld;
  setWorldVisibility: SetVisibility;

  // Links Pivots
  linksRepo: LinksDrizzleRepository;
  assignCityToWorld: AssignCityToWorld;
  removeCityFromWorld: RemoveCityFromWorld;
  assignQuestToPlayer: AssignQuestToPlayer;
  setPlayerQuestStatus: SetPlayerQuestStatus;
  linkQuestToCity: LinkQuestToCity;
  unlinkQuestFromCity: UnlinkQuestFromCity;
  linkLoreToCity: LinkLoreToCity;
  unlinkLoreFromCity: UnlinkLoreFromCity;
};

class Container {
  // Guarda singletons tipados por chave
  private singletons: Partial<{ [K in keyof Registry]: Registry[K] }> = {};

  // Fábricas tipadas — sem switch, sem any
  private factories: { [K in keyof Registry]: (c: Container) => Registry[K] } = {
    // Player
    playerRepo: () => new PlayerDrizzleRepository(),
    createPlayer: (c) => new CreatePlayer(c.resolve('playerRepo')),
    listPlayers: (c) => new ListPlayers(c.resolve('playerRepo')),
    updatePlayer: (c) => new UpdatePlayer(c.resolve('playerRepo')),
    updatePlayerImage: (c) => new UpdatePlayerImage(c.resolve('playerRepo')),
    updatePlayerSheet: (c) => new UpdatePlayerSheet(c.resolve('playerRepo')),
    setPlayerVisibility: (c) => new SetVisibility(c.resolve('playerRepo')),

    // Quest
    questRepo: () => new QuestDrizzleRepository(),
    createQuest: (c) => new CreateQuest(c.resolve('questRepo')),
    listQuests: (c) => new ListQuests(c.resolve('questRepo')),
    completeQuest: (c) => new CompleteQuest(c.resolve('questRepo')),
    updateQuest: (c) => new UpdateQuest(c.resolve('questRepo')),

    // NPC
    npcRepo: () => new NpcDrizzleRepository(),
    createNpc: (c) => new CreateNpc(c.resolve('npcRepo')),
    listNpcs: (c) => new ListNpcs(c.resolve('npcRepo')),
    deleteNpc: (c) => new DeleteNpc(c.resolve('npcRepo')),
    updateNpcImage: (c) => new UpdateNpcImage(c.resolve('npcRepo')),
    updateNpc: (c) => new UpdateNpc(c.resolve('npcRepo')),
    setNpcVisibility: (c) => new SetVisibility(c.resolve('npcRepo')),

    // Sessions
    sessionRepo: () => new SessionDrizzleRepository(),
    createSession: (c) => new CreateSession(c.resolve('sessionRepo')),
    listSessions: (c) => new ListSessions(c.resolve('sessionRepo')),
    deleteSession: (c) => new DeleteSession(c.resolve('sessionRepo')),
    updateSession: (c) => new UpdateSession(c.resolve('sessionRepo')),

    // Lore
    loreRepo: () => new LoreDrizzleRepository(),
    createLore: (c) => new CreateLore(c.resolve('loreRepo')),
    listLores: (c) => new ListLores(c.resolve('loreRepo')),
    deleteLore: (c) => new DeleteLore(c.resolve('loreRepo')),
    updateLore: (c) => new UpdateLore(c.resolve('loreRepo')),
    setLoreVisibility: (c) => new SetVisibility(c.resolve('loreRepo')),

    // Cities
    cityRepo: () => new CityDrizzleRepository(),
    createCity: (c) => new CreateCity(c.resolve('cityRepo')),
    listCities: (c) => new ListCities(c.resolve('cityRepo')),
    setCityDiscovered: (c) => new SetCityDiscovered(c.resolve('cityRepo')),
    deleteCity: (c) => new DeleteCity(c.resolve('cityRepo')),
    updateCity: (c) => new UpdateCity(c.resolve('cityRepo')),
    setCityVisibility: (c) => new SetVisibility(c.resolve('cityRepo')),

    // Bestiary
    monsterRepo: () => new MonsterDrizzleRepository(),
    createMonster: (c) => new CreateMonster(c.resolve('monsterRepo')),
    listMonsters: (c) => new ListMonsters(c.resolve('monsterRepo')),
    setMonsterDiscovered: (c) => new SetMonsterDiscovered(c.resolve('monsterRepo')),
    updateMonsterImage: (c) => new UpdateMonsterImage(c.resolve('monsterRepo')),
    deleteMonster: (c) => new DeleteMonster(c.resolve('monsterRepo')),
    setMonsterVisibility: (c) => new SetVisibility(c.resolve('monsterRepo')),

    // Map Markers
    mapMarkerRepo: () => new MapMarkerDrizzleRepository(),
    createMapMarker: (c) => new CreateMapMarker(c.resolve('mapMarkerRepo')),
    listMapMarkers: (c) => new ListMapMarkers(c.resolve('mapMarkerRepo')),
    setMapMarkerDiscovered: (c) => new SetMapMarkerDiscovered(c.resolve('mapMarkerRepo')),
    deleteMapMarker: (c) => new DeleteMapMarker(c.resolve('mapMarkerRepo')),
    setMapMarkerVisibility: (c) => new SetVisibility(c.resolve('mapMarkerRepo')),

    // Timeline
    timelineRepo: () => new TimelineDrizzleRepository(),
    createTimelineEvent: (c) => new CreateTimelineEvent(c.resolve('timelineRepo')),
    listTimelineEvents: (c) => new ListTimelineEvents(c.resolve('timelineRepo')),
    deleteTimelineEvent: (c) => new DeleteTimelineEvent(c.resolve('timelineRepo')),
    setTimelineVisibility: (c) => new SetVisibility(c.resolve('timelineRepo')),

    // World
    worldRepo: () => new WorldDrizzleRepository(),
    createWorld: (c) => new CreateWorld(c.resolve('worldRepo')),
    listWorlds: (c) => new ListWorlds(c.resolve('worldRepo')),
    updateWorldImage: (c) => new UpdateWorldImage(c.resolve('worldRepo')),
    updateWorld: (c) => new UpdateWorld(c.resolve('worldRepo')),
    setWorldVisibility: (c) => new SetVisibility(c.resolve('worldRepo' /* CORRIGE: 'worldRepo' se tiver */)),

    // Links
    linksRepo: () => new LinksDrizzleRepository(),

    assignCityToWorld: (c) => new AssignCityToWorld(c.resolve('cityRepo')),
    removeCityFromWorld: (c) => new RemoveCityFromWorld(c.resolve('cityRepo')),

    assignQuestToPlayer: (c) => new AssignQuestToPlayer(c.resolve('linksRepo')),
    setPlayerQuestStatus: (c) => new SetPlayerQuestStatus(c.resolve('linksRepo')),

    linkQuestToCity: (c) => new LinkQuestToCity(c.resolve('linksRepo')),
    unlinkQuestFromCity: (c) => new UnlinkQuestFromCity(c.resolve('linksRepo')),

    linkLoreToCity: (c) => new LinkLoreToCity(c.resolve('linksRepo')),
    unlinkLoreFromCity: (c) => new UnlinkLoreFromCity(c.resolve('linksRepo')),
  };

  resolve<K extends keyof Registry>(key: K): Registry[K] {
    const existing = this.singletons[key];
    if (existing) return existing as Registry[K];
    const created = this.factories[key](this);
    this.singletons[key] = created;
    return created;
  }
}

export const container = new Container();
