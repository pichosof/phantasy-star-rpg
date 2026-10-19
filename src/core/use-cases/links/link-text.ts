/**
 * Wiki-style entity links in Markdown: `[[Piata]]`, `[[Rook|the soldier]]`, `[[npc:Rook]]`.
 * Pure helpers shared by the link index, "Appears in" and "History".
 */

export const ENTITY_TYPES = [
  'city',
  'npc',
  'player',
  'dungeon',
  'world',
  'quest',
  'session',
  'lore',
  'wiki',
  'beast',
  'timeline',
  'gmNote',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const isEntityType = (v: string): v is EntityType =>
  (ENTITY_TYPES as readonly string[]).includes(v);

/** Accent-, case- and punctuation-insensitive form used to match names. */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface WikiLink {
  /** Entity type prefix when written as `[[npc:Rook]]`. */
  type?: EntityType;
  /** Name as written (before `|`). */
  name: string;
  label?: string;
}

const LINK_RE = /\[\[([^[\]|\n]{1,120})(?:\|([^[\]\n]{1,120}))?\]\]/g;

export function parseLinks(text: string | null | undefined): WikiLink[] {
  if (!text) return [];
  const out: WikiLink[] = [];
  for (const m of text.matchAll(LINK_RE)) {
    let name = m[1].trim();
    let type: EntityType | undefined;
    const colon = name.indexOf(':');
    if (colon > 0) {
      const prefix = name.slice(0, colon).trim();
      if (isEntityType(prefix)) {
        type = prefix;
        name = name.slice(colon + 1).trim();
      }
    }
    if (name) out.push({ type, name, label: m[2]?.trim() || undefined });
  }
  return out;
}

/** True when `name` appears as a whole word/phrase in `text` (both normalized). */
export function mentionsName(normalizedText: string, normalizedName: string): boolean {
  if (normalizedName.length < 3) return false;
  return ` ${normalizedText} `.includes(` ${normalizedName} `);
}

/** Plain text (Markdown and link syntax removed) for snippets. */
export function plainText(text: string): string {
  return text
    .replace(LINK_RE, (_, name: string, label?: string) => label ?? name.replace(/^\w+:/, ''))
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** ~160 chars of context around the first mention of `name`. */
export function snippetAround(text: string, name: string, size = 160): string {
  const plain = plainText(text);
  const idx = plain.toLowerCase().indexOf(name.toLowerCase());
  if (idx < 0) return plain.slice(0, size) + (plain.length > size ? '…' : '');
  const start = Math.max(0, idx - Math.floor(size / 3));
  const end = Math.min(plain.length, start + size);
  return (start > 0 ? '…' : '') + plain.slice(start, end) + (end < plain.length ? '…' : '');
}
