/**
 * Seeds (or refreshes) the item catalogue of any environment from scripts/items/items.seed.json.
 * Upserts by code through POST /api/gm/items/import, in batches under the 512 KB JSON limit.
 * Items edited by the GM are overwritten only if their code is in the file, so run it once
 * per environment (or after rebuilding the file on purpose).
 *
 * Usage:
 *   API_URL=https://api.rpg.picho.org CLIENT_SECRET=... GM_API_KEY=... ORIGIN=https://rpg.picho.org \
 *     npm run items:seed
 *   (GM_API_KEY falls back to the `gmkey` env var; ORIGIN is needed in production.)
 *   DRY_RUN=1 only prints the batches. SEED_FILE=<path> reads the seed from elsewhere
 *   (the master copy lives outside git: it contains GM-only notes).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const api = (process.env.API_URL ?? 'http://localhost:3010').replace(/\/$/, '');
const clientSecret = process.env.CLIENT_SECRET ?? '';
const gmKey = process.env.GM_API_KEY ?? process.env.gmkey ?? '';
const origin = process.env.ORIGIN;
const dryRun = process.env.DRY_RUN === '1';
const MAX_BYTES = 400_000;
const MAX_ITEMS = 200;

// The seed holds GM-only notes, so it is not in git (public repo): pass SEED_FILE or keep a
// local copy at scripts/items/items.seed.json (gitignored).
const seedFile = process.env.SEED_FILE ?? join(here, 'items.seed.json');
const { items } = JSON.parse(readFileSync(seedFile, 'utf8')) as {
  items: Array<Record<string, unknown>>;
};

const batches: Array<typeof items> = [[]];
let size = 0;
for (const item of items) {
  const bytes = Buffer.byteLength(JSON.stringify(item));
  const current = batches[batches.length - 1];
  if (current.length && (size + bytes > MAX_BYTES || current.length >= MAX_ITEMS)) {
    batches.push([]);
    size = 0;
  }
  batches[batches.length - 1].push(item);
  size += bytes;
}
console.log(`${items.length} items in ${batches.length} batches → ${api}`);
if (dryRun) process.exit(0);
if (!gmKey) throw new Error('GM_API_KEY (or gmkey) is required');

const headers: Record<string, string> = {
  'content-type': 'application/json',
  'x-client-id': clientSecret,
};
if (origin) headers.origin = origin;

const login = await fetch(`${api}/api/auth/login`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ apiKey: gmKey }),
});
if (!login.ok) throw new Error(`GM login failed: ${login.status} ${await login.text()}`);
const { token } = (await login.json()) as { token: string };

let created = 0;
let updated = 0;
for (const [i, batch] of batches.entries()) {
  const res = await fetch(`${api}/api/gm/items/import`, {
    method: 'POST',
    headers: { ...headers, authorization: `Bearer ${token}` },
    body: JSON.stringify({ items: batch }),
  });
  if (!res.ok) throw new Error(`Batch ${i + 1} failed: ${res.status} ${await res.text()}`);
  const r = (await res.json()) as { created: number; updated: number };
  created += r.created;
  updated += r.updated;
  console.log(`batch ${i + 1}/${batches.length}: +${r.created} new, ${r.updated} updated`);
}
console.log(`done: ${created} created, ${updated} updated`);
