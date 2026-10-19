import type { LinkableEntity, LinkableRepository } from '../../core/use-cases/links/links.js';
import { db, schema as s } from '../db/index.js';

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
    ]);

    const out: LinkableEntity[] = [];
    for (const r of cities)
      out.push({
        type: 'city',
        id: r.id,
        name: r.name,
        subtitle: r.region,
        imageUrl: r.imageUrl,
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
        imageUrl: r.imageUrl,
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
        imageUrl: r.imageUrl,
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
        imageUrl: r.imageUrl,
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
        imageUrl: r.imageUrl,
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
        imageUrl: r.imageUrl,
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
