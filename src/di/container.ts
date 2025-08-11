import { CreateMonster } from '../core/use-cases/bestiary/create-monster';
import { DeleteMonster } from '../core/use-cases/bestiary/delete-monster';
import { ListMonsters } from '../core/use-cases/bestiary/list-monsters';
import { SetMonsterDiscovered } from '../core/use-cases/bestiary/set-monster-discovered';
import { UpdateMonsterImage } from '../core/use-cases/bestiary/update-monster-image';
import { CreateCity } from '../core/use-cases/cities/create-city';
import { DeleteCity } from '../core/use-cases/cities/delete-city';
import { ListCities } from '../core/use-cases/cities/list-cities';
import { SetCityDiscovered } from '../core/use-cases/cities/set-city-discovered';
import { CreateLore } from '../core/use-cases/lore/create-lore';
import { DeleteLore } from '../core/use-cases/lore/delete-lore';
import { ListLores } from '../core/use-cases/lore/list-lores';
import { CreateMapMarker } from '../core/use-cases/map-marker/create-map-marker';
import { DeleteMapMarker } from '../core/use-cases/map-marker/delete-map-marker';
import { ListMapMarkers } from '../core/use-cases/map-marker/list-map-markers';
import { SetMapMarkerDiscovered } from '../core/use-cases/map-marker/set-map-marker-discovered';
import { CreateNpc } from '../core/use-cases/npc/create-npc';
import { DeleteNpc } from '../core/use-cases/npc/delete-npc';
import { ListNpcs } from '../core/use-cases/npc/list-npcs';
import { UpdateNpcImage } from '../core/use-cases/npc/update-npc-image';
import { CreatePlayer } from '../core/use-cases/player/create-player';
import { ListPlayers } from '../core/use-cases/player/list-players';
import { CompleteQuest } from '../core/use-cases/quest/complete-quest';
import { CreateQuest } from '../core/use-cases/quest/create-quest';
import { ListQuests } from '../core/use-cases/quest/list-quests';
import { CreateSession } from '../core/use-cases/session/create-session';
import { DeleteSession } from '../core/use-cases/session/delete-session';
import { ListSessions } from '../core/use-cases/session/list-sessions';
import { CreateTimelineEvent } from '../core/use-cases/timeline/create-timeline-event';
import { DeleteTimelineEvent } from '../core/use-cases/timeline/delete-timeline-event';
import { ListTimelineEvents } from '../core/use-cases/timeline/list-timeline-events';
import { CityDrizzleRepository } from '../infra/repositories/city.drizzle.repository';
import { LoreDrizzleRepository } from '../infra/repositories/lore.drizzle.repository';
import { MapMarkerDrizzleRepository } from '../infra/repositories/map-marker.drizzle.repository';
import { MonsterDrizzleRepository } from '../infra/repositories/monster.drizzle.repository';
import { NpcDrizzleRepository } from '../infra/repositories/npc.drizzle.repository';
import { PlayerDrizzleRepository } from '../infra/repositories/player.drizzle.repository';
import { QuestDrizzleRepository } from '../infra/repositories/quest.drizzle.repository';
import { SessionDrizzleRepository } from '../infra/repositories/session.drizzle.repository';
import { TimelineDrizzleRepository } from '../infra/repositories/timeline.drizzle.repository';

// ----- Tipos do container
export type Registry = {
  // Player
  playerRepo: PlayerDrizzleRepository;
  createPlayer: CreatePlayer;
  listPlayers: ListPlayers;

  // Quest
  questRepo: QuestDrizzleRepository;
  createQuest: CreateQuest;
  listQuests: ListQuests;
  completeQuest: CompleteQuest;

  // NPC
  npcRepo: NpcDrizzleRepository;
  createNpc: CreateNpc;
  listNpcs: ListNpcs;
  deleteNpc: DeleteNpc;
  updateNpcImage: UpdateNpcImage;

  // Sessions
  sessionRepo: SessionDrizzleRepository;
  createSession: CreateSession;
  listSessions: ListSessions;
  deleteSession: DeleteSession;

  // Lore
  loreRepo: LoreDrizzleRepository;
  createLore: CreateLore;
  listLores: ListLores;
  deleteLore: DeleteLore;

  // Cities
  cityRepo: CityDrizzleRepository;
  createCity: CreateCity;
  listCities: ListCities;
  setCityDiscovered: SetCityDiscovered;
  deleteCity: DeleteCity;

  // Bestiary
  monsterRepo: MonsterDrizzleRepository;
  createMonster: CreateMonster;
  listMonsters: ListMonsters;
  setMonsterDiscovered: SetMonsterDiscovered;
  updateMonsterImage: UpdateMonsterImage;
  deleteMonster: DeleteMonster;

  // Map Markers
  mapMarkerRepo: MapMarkerDrizzleRepository;
  createMapMarker: CreateMapMarker;
  listMapMarkers: ListMapMarkers;
  setMapMarkerDiscovered: SetMapMarkerDiscovered;
  deleteMapMarker: DeleteMapMarker;

  // Timeline
  timelineRepo: TimelineDrizzleRepository;
  createTimelineEvent: CreateTimelineEvent;
  listTimelineEvents: ListTimelineEvents;
  deleteTimelineEvent: DeleteTimelineEvent;
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

    // Quest
    questRepo: () => new QuestDrizzleRepository(),
    createQuest: (c) => new CreateQuest(c.resolve('questRepo')),
    listQuests: (c) => new ListQuests(c.resolve('questRepo')),
    completeQuest: (c) => new CompleteQuest(c.resolve('questRepo')),

    // NPC
    npcRepo: () => new NpcDrizzleRepository(),
    createNpc: (c) => new CreateNpc(c.resolve('npcRepo')),
    listNpcs: (c) => new ListNpcs(c.resolve('npcRepo')),
    deleteNpc: (c) => new DeleteNpc(c.resolve('npcRepo')),
    updateNpcImage: (c) => new UpdateNpcImage(c.resolve('npcRepo')),

    // Sessions
    sessionRepo: () => new SessionDrizzleRepository(),
    createSession: (c) => new CreateSession(c.resolve('sessionRepo')),
    listSessions: (c) => new ListSessions(c.resolve('sessionRepo')),
    deleteSession: (c) => new DeleteSession(c.resolve('sessionRepo')),

    // Lore
    loreRepo: () => new LoreDrizzleRepository(),
    createLore: (c) => new CreateLore(c.resolve('loreRepo')),
    listLores: (c) => new ListLores(c.resolve('loreRepo')),
    deleteLore: (c) => new DeleteLore(c.resolve('loreRepo')),

    // Cities
    cityRepo: () => new CityDrizzleRepository(),
    createCity: (c) => new CreateCity(c.resolve('cityRepo')),
    listCities: (c) => new ListCities(c.resolve('cityRepo')),
    setCityDiscovered: (c) => new SetCityDiscovered(c.resolve('cityRepo')),
    deleteCity: (c) => new DeleteCity(c.resolve('cityRepo')),

    // Bestiary
    monsterRepo: () => new MonsterDrizzleRepository(),
    createMonster: (c) => new CreateMonster(c.resolve('monsterRepo')),
    listMonsters: (c) => new ListMonsters(c.resolve('monsterRepo')),
    setMonsterDiscovered: (c) => new SetMonsterDiscovered(c.resolve('monsterRepo')),
    updateMonsterImage: (c) => new UpdateMonsterImage(c.resolve('monsterRepo')),
    deleteMonster: (c) => new DeleteMonster(c.resolve('monsterRepo')),

    // Map Markers
    mapMarkerRepo: () => new MapMarkerDrizzleRepository(),
    createMapMarker: (c) => new CreateMapMarker(c.resolve('mapMarkerRepo')),
    listMapMarkers: (c) => new ListMapMarkers(c.resolve('mapMarkerRepo')),
    setMapMarkerDiscovered: (c) => new SetMapMarkerDiscovered(c.resolve('mapMarkerRepo')),
    deleteMapMarker: (c) => new DeleteMapMarker(c.resolve('mapMarkerRepo')),

    // Timeline
    timelineRepo: () => new TimelineDrizzleRepository(),
    createTimelineEvent: (c) => new CreateTimelineEvent(c.resolve('timelineRepo')),
    listTimelineEvents: (c) => new ListTimelineEvents(c.resolve('timelineRepo')),
    deleteTimelineEvent: (c) => new DeleteTimelineEvent(c.resolve('timelineRepo')),
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
