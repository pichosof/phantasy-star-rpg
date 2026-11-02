import type { APIEmbedField } from 'discord.js';

import { ItemNotFoundError, type PlayerItem } from '../../../core/use-cases/items/items.js';
import { normalizeName } from '../../../core/use-cases/links/link-text.js';
import { container } from '../../../di/container.js';
import {
  type BotReply,
  COLOR,
  errorReply,
  linkButton,
  siteUrl,
  toDiscordMarkdown,
  truncate,
} from '../format.js';

const credits = (n: number | null | undefined) =>
  n === null || n === undefined ? null : `${n.toLocaleString('en-US')} cr`;

const isPublic = (i: { visibility?: string; status?: string }) =>
  i.visibility === 'public' && i.status === 'published';

/** Autocomplete over the catalogue the caller may see (players: published public items). */
export async function itemChoices(query: string, gm: boolean) {
  const q = normalizeName(query);
  const items = (await container.resolve('listItems').execute(gm)) as (PlayerItem & {
    localName?: string | null;
    visibility?: string;
    status?: string;
  })[];
  return items
    .map((i) => {
      const name = gm ? (i.localName ?? i.name) : i.name;
      const n = normalizeName(`${name} ${i.code}`);
      const score = !q
        ? 1
        : n.startsWith(q)
          ? 3
          : ` ${n}`.includes(` ${q}`)
            ? 2
            : n.includes(q)
              ? 1
              : 0;
      return { i, name, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 25)
    .map(({ i, name }) => ({
      name: `${name} · Lv ${i.level}${gm && !isPublic(i) ? ' · 🔒' : ''}`.slice(0, 100),
      value: String(i.id),
    }));
}

/**
 * A picked suggestion (the item id) or a typed name/code. Typed text must match exactly
 * (accents and case aside) and be unique: no "closest match" guessing.
 */
export async function resolveItemId(
  value: string,
  gm: boolean,
): Promise<{ id: number } | { error: string }> {
  if (/^\d+$/.test(value.trim())) return { id: Number(value.trim()) };
  const key = normalizeName(value);
  const items = (await container.resolve('listItems').execute(gm)) as {
    id: number;
    code: string;
    name: string;
    localName?: string | null;
    originalName?: string | null;
  }[];
  const matches = items.filter((i) =>
    [i.code, i.name, i.localName, i.originalName].some((n) => n && normalizeName(n) === key),
  );
  if (matches.length === 1) return { id: matches[0].id };
  return {
    error: matches.length
      ? `Several items match **${value.trim()}**. Pick one of the suggestions.`
      : `No item is called **${value.trim()}**. Pick one of the suggestions.`,
  };
}

/** Item card: players get the catalogue view; the GM's private view adds access, prices and notes. */
export async function itemReply(
  id: number,
  opts: { gm: boolean; private: boolean },
): Promise<BotReply> {
  const full = opts.gm && opts.private;
  let item: Record<string, unknown>;
  try {
    item = (await container.resolve('getItem').execute(id, full)) as Record<string, unknown>;
  } catch (e) {
    if (!(e instanceof ItemNotFoundError)) throw e;
    return errorReply(
      opts.gm && !opts.private
        ? '🔒 Not in the player catalogue. Use `private: True`.'
        : 'Item not found.',
    );
  }

  const str = (k: string) =>
    item[k] === null || item[k] === undefined || item[k] === '' ? null : String(item[k]);
  const name = full ? (str('localName') ?? str('name')) : str('name');
  const original = full ? (str('localName') ? str('name') : null) : str('originalName');

  const fields: APIEmbedField[] = [];
  const add = (label: string, value: string | null, inline = true) => {
    if (value) fields.push({ name: label, value: truncate(value, 1024), inline });
  };
  add('Level', String(item.level ?? 0));
  add('Type', [str('type'), str('kind')].filter(Boolean).join(' · ') || null);
  add('Price', credits(item.localPrice as number | null));
  add(
    'Damage',
    str('damage') ? `${str('damage')}${str('damageType') ? ` (${str('damageType')})` : ''}` : null,
  );
  add('Availability', full ? str('access') : str('availability'));
  add('Region', str('region'));
  if (str('availabilityNote')) add('Where to find', str('availabilityNote'), false);
  if (str('rules')) add('Rules', truncate(toDiscordMarkdown(str('rules')), 1000), false);
  if (full) {
    add('Reference price', credits(item.refPrice as number | null));
    add('Channel', str('channel'), false);
    if (str('gmNotes')) add('GM notes', truncate(toDiscordMarkdown(str('gmNotes')), 1000), false);
  }

  const description = toDiscordMarkdown(str('description'));
  const hidden = full && !isPublic(item as { visibility?: string; status?: string });
  return {
    embeds: [
      {
        color: hidden ? COLOR.muted : COLOR.gold,
        author: { name: `🎒 Item${str('code') ? ` · ${str('code')}` : ''}` },
        title: truncate(name ?? 'Item', 256),
        url: siteUrl('item'),
        ...(original || description
          ? {
              description: truncate(
                [original ? `*${original}*` : '', description].filter(Boolean).join('\n\n'),
                2500,
              ),
            }
          : {}),
        fields,
        ...(hidden ? { footer: { text: '🔒 Not in the player catalogue' } } : {}),
      },
    ],
    components: [linkButton('Open catalogue', siteUrl('item'))],
    ephemeral: opts.private,
  };
}
