import {
  type EntityType,
  mentionsName,
  normalizeName,
  parseLinks,
  snippetAround,
} from './link-text.js';

/** Any entity that can be linked to and/or contains linkable text. */
export interface LinkableEntity {
  type: EntityType;
  id: number;
  name: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  /** Markdown text fields joined (empty when the caller may not read them). */
  text: string;
  /** In-game date label (sessions, timeline). */
  date?: string | null;
  visible: boolean;
  /** False for undiscovered creatures/dungeons: players only get their name. */
  readable: boolean;
  /** False for undiscovered creatures/dungeons/cities: players do not get their image. */
  discovered?: boolean;
}

export interface LinkableRepository {
  /** Every linkable entity; GM-only types (gm notes) only when `gm`. */
  listAll(gm: boolean): Promise<LinkableEntity[]>;
}

export class LinkTargetNotFoundError extends Error {
  readonly statusCode = 404;
  constructor() {
    super('Not found');
  }
}

/** Order in which types win when two entities share a name. */
const TYPE_PRIORITY: EntityType[] = [
  'npc',
  'player',
  'city',
  'dungeon',
  'world',
  'beast',
  'quest',
  'lore',
  'wiki',
  'session',
  'timeline',
  'gmNote',
];

/** Entities the caller may see: players never get hidden ones, nor text they may not read. */
function visibleTo(all: LinkableEntity[], gm: boolean): LinkableEntity[] {
  if (gm) return all;
  return all
    .filter((e) => e.visible)
    .map((e) => ({
      ...e,
      text: e.readable ? e.text : '',
      imageUrl: e.discovered === false ? null : e.imageUrl,
    }));
}

/** Resolves a written link to an entity (type prefix first, then name with type priority). */
export function resolveLink(
  entities: LinkableEntity[],
  link: { type?: EntityType; name: string },
): LinkableEntity | undefined {
  const key = normalizeName(link.name);
  const candidates = entities.filter(
    (e) => normalizeName(e.name) === key && (!link.type || e.type === link.type),
  );
  return candidates.sort(
    (a, b) => TYPE_PRIORITY.indexOf(a.type) - TYPE_PRIORITY.indexOf(b.type),
  )[0];
}

export class GetLinkIndex {
  constructor(private repo: LinkableRepository) {}
  async execute(gm: boolean) {
    return visibleTo(await this.repo.listAll(gm), gm).map(({ type, id, name, subtitle }) => ({
      type,
      id,
      name,
      subtitle: subtitle ?? null,
    }));
  }
}

export interface Mention {
  type: EntityType;
  id: number;
  name: string;
  date?: string | null;
  /** Linked with [[...]] (true) or just named in the text (false). */
  explicit: boolean;
  snippet: string;
}

/** Preview of an entity plus where it is mentioned ("Appears in") and its history. */
export class GetEntityLinks {
  constructor(private repo: LinkableRepository) {}

  async execute(type: EntityType, id: number, gm: boolean) {
    const all = visibleTo(await this.repo.listAll(gm), gm);
    const target = all.find((e) => e.type === type && e.id === id);
    if (!target) throw new LinkTargetNotFoundError();

    const targetKey = normalizeName(target.name);
    const mentions: Mention[] = [];
    for (const source of all) {
      if (source === target || !source.text) continue;
      const explicit = parseLinks(source.text).some((l) => resolveLink(all, l) === target);
      const plain = !explicit && mentionsName(normalizeName(source.text), targetKey);
      if (!explicit && !plain) continue;
      mentions.push({
        type: source.type,
        id: source.id,
        name: source.name,
        date: source.date ?? null,
        explicit,
        snippet: snippetAround(source.text, target.name),
      });
    }

    const byOrder = (a: Mention, b: Mention) => a.id - b.id;
    return {
      entity: {
        type: target.type,
        id: target.id,
        name: target.name,
        subtitle: target.subtitle ?? null,
        imageUrl: target.imageUrl ?? null,
        text: target.text,
        date: target.date ?? null,
        readable: target.readable || gm,
      },
      appearsIn: mentions
        .filter((m) => m.type !== 'timeline' && m.type !== 'session')
        .sort((a, b) => Number(b.explicit) - Number(a.explicit) || a.name.localeCompare(b.name)),
      history: {
        timeline: mentions.filter((m) => m.type === 'timeline').sort(byOrder),
        sessions: mentions.filter((m) => m.type === 'session').sort(byOrder),
      },
    };
  }
}
