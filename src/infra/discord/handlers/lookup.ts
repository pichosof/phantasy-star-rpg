import type { APIEmbed, APIEmbedField } from 'discord.js';

import {
  type EntityType,
  isEntityType,
  normalizeName,
} from '../../../core/use-cases/links/link-text.js';
import {
  type GetEntityLinks,
  type LinkableEntity,
  LinkTargetNotFoundError,
  visibleTo,
} from '../../../core/use-cases/links/links.js';
import { container } from '../../../di/container.js';
import {
  type BotReply,
  COLOR,
  errorReply,
  imageUrl,
  linkButton,
  siteUrl,
  SUBTITLE_LABEL,
  toDiscordMarkdown,
  truncate,
  TYPE_ICON,
  TYPE_LABEL,
} from '../format.js';

import { itemReply } from './item.js';

export interface EntityRef {
  type: EntityType;
  id: number;
}

/** Every entity the caller may know about (GM: everything, hidden included). Always fresh. */
export async function knownEntities(gm: boolean): Promise<LinkableEntity[]> {
  return visibleTo(await container.resolve('linkableRepo').listAll(gm), gm);
}

// Autocomplete fires on every keystroke: a very short cache keeps it off the DB.
// Only suggestions use it; anything that shows content reads fresh data.
const SUGGEST_CACHE_MS = 5_000;
const cache = new Map<boolean, { at: number; rows: LinkableEntity[] }>();

async function suggestable(gm: boolean): Promise<LinkableEntity[]> {
  const hit = cache.get(gm);
  if (hit && Date.now() - hit.at < SUGGEST_CACHE_MS) return hit.rows;
  const rows = await knownEntities(gm);
  cache.set(gm, { at: Date.now(), rows });
  return rows;
}

export const clearEntityCache = () => cache.clear();

export const refValue = (e: EntityRef) => `${e.type}:${e.id}`;

/** Autocomplete choices: names starting with the query first, then names containing it. */
export async function entityChoices(
  query: string,
  gm: boolean,
  filter: (e: LinkableEntity) => boolean = () => true,
) {
  const q = normalizeName(query);
  const rows = (await suggestable(gm)).filter(filter);
  const scored = rows
    .map((e) => {
      const name = normalizeName(e.name);
      const score = !q
        ? 1
        : name.startsWith(q)
          ? 3
          : ` ${name}`.includes(` ${q}`)
            ? 2
            : name.includes(q)
              ? 1
              : 0;
      return { e, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name));
  return scored.slice(0, 25).map(({ e }) => ({
    name: `${TYPE_ICON[e.type]} ${e.name} · ${TYPE_LABEL[e.type]}${gm && !e.visible ? ' · 🔒 hidden' : ''}`.slice(
      0,
      100,
    ),
    value: refValue(e),
  }));
}

export type Resolved = { ref: EntityRef } | { error: string };

/**
 * A picked suggestion (`city:12`) or a typed name. A typed name must match exactly
 * (accents and case aside) and be unique: no "closest match" guessing.
 */
export async function resolveRef(
  value: string,
  gm: boolean,
  filter: (e: LinkableEntity) => boolean = () => true,
): Promise<Resolved> {
  const m = /^(\w+):(\d+)$/.exec(value.trim());
  if (m && isEntityType(m[1])) return { ref: { type: m[1], id: Number(m[2]) } };
  const key = normalizeName(value);
  const matches = (await knownEntities(gm))
    .filter(filter)
    .filter((e) => normalizeName(e.name) === key);
  if (matches.length === 1) return { ref: { type: matches[0].type, id: matches[0].id } };
  if (!matches.length)
    return { error: `Nothing is called **${value.trim()}**. Pick one of the suggestions.` };
  return {
    error: `Several entries are called **${value.trim()}** (${matches
      .map((e) => TYPE_LABEL[e.type])
      .join(', ')}). Pick one of the suggestions.`,
  };
}

type Links = Awaited<ReturnType<GetEntityLinks['execute']>>;

/** Rich card for any entity: picture, what it is, its text, where it appears. */
export function entityEmbed(
  links: Links,
  opts: { hidden?: boolean; headline?: string } = {},
): APIEmbed {
  const e = links.entity;
  const fields: APIEmbedField[] = [];
  const subtitleLabel = SUBTITLE_LABEL[e.type];
  if (e.subtitle && subtitleLabel && e.type !== 'session' && e.type !== 'timeline')
    fields.push({ name: subtitleLabel, value: truncate(String(e.subtitle), 200), inline: true });
  if (e.date) fields.push({ name: 'When', value: truncate(e.date, 200), inline: true });

  const appears = links.appearsIn.slice(0, 8).map((m) => `${TYPE_ICON[m.type]} ${m.name}`);
  if (appears.length)
    fields.push({
      name: 'Appears in',
      value: truncate(
        appears.join(' · ') +
          (links.appearsIn.length > 8 ? ` · +${links.appearsIn.length - 8}` : ''),
        1000,
      ),
    });
  const history = [...links.history.sessions, ...links.history.timeline].slice(-3);
  if (history.length)
    fields.push({
      name: 'Recent history',
      value: truncate(
        history
          .map((h) => `${TYPE_ICON[h.type]} ${h.name}${h.date ? ` *(${h.date})*` : ''}`)
          .join('\n'),
        1000,
      ),
    });

  const body = e.readable ? toDiscordMarkdown(e.text) : '*Not yet discovered.*';
  const image = imageUrl(e.imageUrl);
  return {
    color: opts.hidden ? COLOR.muted : COLOR.brand,
    author: { name: opts.headline ?? `${TYPE_ICON[e.type]} ${TYPE_LABEL[e.type]}` },
    title: truncate(e.name, 256),
    url: siteUrl(e.type),
    ...(body ? { description: truncate(body, 3000) } : {}),
    fields,
    ...(image ? { image: { url: image } } : {}),
    ...(opts.hidden ? { footer: { text: '🔒 Hidden from players' } } : {}),
  };
}

const HIDDEN_HINT =
  '🔒 Players cannot see this yet. Use `private: True` to read it, or `/reveal` it.';

/**
 * Public answers always use the player view, even for the GM, so nothing hidden lands in a
 * channel by accident. The GM gets the full view only privately.
 */
export async function lookupReply(
  ref: EntityRef,
  opts: { gm: boolean; private: boolean },
): Promise<BotReply> {
  const fullView = opts.gm && opts.private;
  if (ref.type === 'item') return itemReply(ref.id, { gm: opts.gm, private: opts.private });
  let links: Links;
  try {
    links = await container.resolve('getEntityLinks').execute(ref.type, ref.id, fullView);
  } catch (e) {
    if (!(e instanceof LinkTargetNotFoundError)) throw e;
    return errorReply(opts.gm && !opts.private ? HIDDEN_HINT : 'Nothing found.');
  }
  const hidden =
    fullView &&
    !(await knownEntities(true)).find((x) => x.type === ref.type && x.id === ref.id)?.visible;
  return {
    embeds: [entityEmbed(links, { hidden })],
    components: [linkButton('Open on site', siteUrl(ref.type))],
    ephemeral: opts.private,
  };
}
