// Imports the Bestiário de Motávia stat blocks through the API.
// Usage: node scripts/bestiary/import-stat-blocks.mjs <apiBase> <clientSecretFile> [--dry-run]
// Idempotent: matches creatures by name, replaces their stat blocks.
// GM key from env `gmkey`. New creatures are created hidden and undiscovered.
import fs from 'node:fs';
import path from 'node:path';

const [API, secretFile] = process.argv.slice(2);
const dry = process.argv.includes('--dry-run');
const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const SECRET = fs.readFileSync(secretFile, 'utf8').trim();
const data = JSON.parse(fs.readFileSync(path.join(DIR, 'stat-blocks.json'), 'utf8'));

const base = { 'content-type': 'application/json', 'x-client-id': SECRET };
const login = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: base,
  body: JSON.stringify({ apiKey: process.env.gmkey }),
});
if (!login.ok) throw new Error(`login ${login.status}`);
const { token } = await login.json();
const call = async (method, p, body) => {
  const r = await fetch(`${API}${p}`, {
    method,
    headers: { ...base, authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${p} → ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
};

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const existing = await call('GET', '/api/bestiary');
const byName = new Map(existing.map((m) => [norm(m.name), m]));

let created = 0;
let updated = 0;
let blocksTotal = 0;
for (const sp of data.species) {
  let monster = byName.get(norm(sp.species));
  if (!monster) {
    console.log(`+ new (hidden): ${sp.species}`);
    if (!dry) {
      monster = await call('POST', '/api/bestiary', {
        name: sp.species,
        type: sp.new?.type ?? null,
        habitat: sp.new?.habitat ?? null,
      });
    }
    created += 1;
  } else {
    updated += 1;
  }
  const blocks = sp.profiles.map(({ page, ...b }) => ({
    ...b,
    attacks: b.attacks ?? [],
    abilities: (b.abilities ?? []).map((a) => ({ name: a.name, text: a.text ?? '' })),
    source: `Bestiário de Motávia AW 2284 — ${page}`,
  }));
  blocksTotal += blocks.length;
  if (!dry && monster) await call('PUT', `/api/gm/bestiary/${monster.id}/stat-blocks`, { blocks });
  console.log(`  ${sp.species}: ${blocks.map((b) => `${b.label} CR ${b.cr}`).join(' | ')}`);
}
console.log(
  `\n${dry ? '[dry-run] ' : ''}${updated} existing + ${created} new creatures, ${blocksTotal} stat blocks.`,
);
const missing = existing.filter((m) => !data.species.some((s) => norm(s.species) === norm(m.name)));
console.log(`Bestiary entries without a book stat block: ${missing.map((m) => m.name).join(', ')}`);
