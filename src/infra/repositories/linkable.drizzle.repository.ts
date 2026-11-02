import { asc } from 'drizzle-orm';

import type { LinkableEntity, LinkableRepository } from '../../core/use-cases/links/links.js';
import { db, schema as s } from '../db/index.js';

/** Gallery URLs per owner id, in the site's order (position, then upload time). */
function galleryBy<T extends { url: string }>(rows: T[], owner: (r: T) => number) {
  const map = new Map<number, string[]>();
  for (const r of rows) map.set(owner(r), [...(map.get(owner(r)) ?? []), r.url]);
  return map;
}

/** Same cover rule as the site: gallery first, then the single imageUrl. */
function pictures(gallery: string[] | undefined, imageUrl?: string | null) {
  const images = [...(gallery ?? [])];
  if (imageUrl && !images.includes(imageUrl)) images.push(imageUrl);
  return { imageUrl: images[0] ?? null, images };
}

const join = (...parts: Array<string | null | undefined>) => parts.filter(Boolean).join('\n\n');

/** Reads every linkable entity in one pass (small campaign DB: no index table needed). */
export class LinkableDrizzleRepository implements LinkableRepository {
  async listAll(gm: boolean): Promise<LinkableEntity[]> {
    const [
      cities,
      npcs,
      players,
      dungeons,
      worlds,
      quests,
      sessions,
      lores,
      wiki,
      beasts,
      timeline,
      notes,
      items,
      cityGallery,
      dungeonGallery,
    ] = await Promise.all([
      db.select().from(s.cities),
      db.select().from(s.npcs),
      db.select().from(s.players),
      db.select().from(s.dungeons),
      db.select().from(s.worlds),
      db.select().from(s.quests),
      db.select().from(s.sessions),
      db.select().from(s.lores),
      db.select().from(s.wikiPages),
      db.select().from(s.bestiary),
      db.select().from(s.timelineEvents),
      gm ? db.select().from(s.gmNotes) : Promise.resolve([]),
      db.select().from(s.items),
      db
        .select()
        .from(s.cityImages)
        .orderBy(asc(s.cityImages.position), asc(s.cityImages.createdAt)),
      db
        .select()
        .from(s.dungeonImages)
        .orderBy(asc(s.dungeonImages.position), asc(s.dungeonImages.createdAt)),
    ]);
    const cityPics = galleryBy(cityGallery, (r) => r.cityId);
    const dungeonPics = galleryBy(dungeonGallery, (r) => r.dungeonId);

    const out: LinkableEntity[] = [];
    for (const r of cities)
      out.push({
        type: 'city',
        id: r.id,
        name: r.name,
        subtitle: r.region,
        ...pictures(cityPics.get(r.id), r.imageUrl),
        text: join(r.description),
        visible: r.visible,
        readable: true,
        discovered: r.discovered,
      });
    for (const r of npcs)
      out.push({
        type: 'npc',
        id: r.id,
        name: r.name,
        subtitle: r.role,
        ...pictures(undefined, r.imageUrl),
        text: join(r.description),
        visible: r.visible,
        readable: true,
      });
    for (const r of players)
      out.push({
        type: 'player',
        id: r.id,
        name: r.name,
        subtitle: `Level ${r.level}`,
        ...pictures(undefined, r.imageUrl),
        text: join(r.background),
        visible: r.visible,
        readable: true,
      });
    for (const r of dungeons)
      out.push({
        type: 'dungeon',
        id: r.id,
        name: r.name,
        subtitle: r.type,
        ...pictures(dungeonPics.get(r.id)),
        text: join(r.description),
        visible: r.visible,
        readable: r.discovered,
        discovered: r.discovered,
      });
    for (const r of worlds)
      out.push({
        type: 'world',
        id: r.id,
        name: r.name,
        ...pictures(undefined, r.imageUrl),
        text: join(r.description),
        visible: r.visible,
        readable: true,
      });
    for (const r of quests)
      out.push({
        type: 'quest',
        id: r.id,
        name: r.title,
        subtitle: r.status,
        text: join(r.description, r.reward),
        visible: r.visible,
        readable: true,
      });
    for (const r of sessions)
      out.push({
        type: 'session',
        id: r.id,
        name: r.title,
        subtitle: r.date,
        ...pictures(undefined, r.imageUrl),
        date: r.date,
        text: join(r.summary),
        visible: r.visible,
        readable: true,
      });
    for (const r of lores)
      out.push({
        type: 'lore',
        id: r.id,
        name: r.title,
        subtitle: r.category,
        text: join(r.content),
        visible: r.visible,
        readable: true,
      });
    for (const r of wiki)
      out.push({
        type: 'wiki',
        id: r.id,
        name: r.title,
        subtitle: r.category,
        text: join(r.content),
        visible: r.visible,
        readable: true,
      });
    for (const r of beasts)
      out.push({
        type: 'beast',
        id: r.id,
        name: r.name,
        subtitle: r.type,
        ...pictures(undefined, r.imageUrl),
        text: join(r.description, r.habitat, r.weaknesses),
        visible: r.visible,
        readable: r.discovered,
        discovered: r.discovered,
      });
    for (const r of timeline)
      out.push({
        type: 'timeline',
        id: r.id,
        name: r.title,
        subtitle: r.date,
        date: r.date,
        text: join(r.description),
        visible: r.visible,
        readable: true,
      });
    for (const r of notes)
      out.push({
        type: 'gmNote',
        id: r.id,
        name: r.title,
        text: join(r.content),
        visible: false,
        readable: true,
      });
    // Items: players find published public items only, by their Motávia name; text is the
    // player description (never GM notes or the audit).
    for (const r of items)
      out.push({
        type: 'item',
        id: r.id,
        name: r.localName ?? r.name,
        subtitle: r.kind,
        text: join(r.description),
        visible: r.visibility === 'public' && r.status === 'published',
        readable: true,
      });
    return out;
  }
}
