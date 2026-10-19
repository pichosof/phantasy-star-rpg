import { z } from 'zod';

import { normalizeName, plainText, snippetAround } from './link-text.js';
import { type LinkableRepository, visibleTo } from './links.js';

export const searchInput = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

/**
 * Global search over every linkable entity (names first, then text), with the same
 * visibility rules as wiki links: players never get hidden entities nor unrevealed text.
 * The campaign DB is small, so an in-memory scan is fast enough (no FTS index to maintain).
 */
export class SearchEntities {
  constructor(private repo: LinkableRepository) {}

  async execute(input: unknown, gm: boolean) {
    const { q, limit } = searchInput.parse(input);
    const terms = normalizeName(q).split(' ').filter(Boolean);
    if (!terms.length) return [];
    const phrase = terms.join(' ');

    const scored = [];
    for (const e of visibleTo(await this.repo.listAll(gm), gm)) {
      // Names/subtitles match word beginnings (search as you type: "mar" finds "Mara");
      // body text only matches whole words, so "mara" does not hit "Maravilhas".
      const name = ` ${normalizeName(e.name)}`;
      const head = `${name} ${normalizeName(e.subtitle ?? '')}`;
      const text = e.text ? ` ${normalizeName(e.text)} ` : '';
      const word = (t: string) => ` ${t}`;
      const matches = (t: string) => head.includes(word(t)) || text.includes(` ${t} `);
      if (!terms.every(matches)) continue;

      let score = 0;
      if (name === word(phrase)) score += 100;
      else if (name.startsWith(word(phrase))) score += 60;
      else if (name.includes(word(phrase))) score += 40;
      score += terms.filter((t) => name.includes(word(t))).length * 10;
      if (text.includes(` ${phrase} `)) score += 5;

      const inName = terms.every((t) => name.includes(word(t)));
      scored.push({
        score,
        type: e.type,
        id: e.id,
        name: e.name,
        subtitle: e.subtitle ?? null,
        snippet: inName || !e.text ? plainText(e.text).slice(0, 140) : snippetAround(e.text, q),
      });
    }

    return scored
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((r) => ({
        type: r.type,
        id: r.id,
        name: r.name,
        subtitle: r.subtitle,
        snippet: r.snippet,
      }));
  }
}
