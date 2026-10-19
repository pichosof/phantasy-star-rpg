# TODO · Picho-RPG feature roadmap

Approved by the owner (the GM) on 2026-10-18. Covers both repos:

- Back: `E:\Projects\phantasy-star-rpg`
- Front: `E:\Projects\phantasy-star-rpg.front`

Read [handoff.md](handoff.md) first for context, conventions and the owner's rules. The site UI is in **English**. Items are roughly in the suggested order; every item lists what to reuse.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## 0. Foundations (do first: they make the rest safe)

### [x] 0.1 Backend tests + CI green

- The test DB migrations are incomplete: the `dungeons`, `tags` and `player_notes` tables are missing from `drizzle/migrations/`. Production does **not** run migrations (tables like `image_focus` are created at boot in `src/infra/db/index.ts`).
- Decide on one source of truth: either generate the missing migrations, or make the tests build the schema the same way boot does.
- `tests/player.routes.test.ts` is outdated: update it to the current API.
- Goal: `npm run check` passes locally and in GitHub Actions on both repos.

### [x] 0.2 One-command deploy

- Back: build the image → push to ACR `pichorpg2404acr` → update Container App `picho-rpg-api` (rg `AZR-BR`).
- Front: build → deploy to Static Web App `picho-rpg-web`.
- Provide one script, or `workflow_dispatch` workflows, that runs the checks before deploying.

### [x] 0.3 Restore backup from the GM UI

- Backups already exist (`src/infra/backup/`, private container `db-backups`). Today the GM can download the DB and trigger a backup.
- Add:
  - `GET /api/gm/database/backups` to list backups;
  - `POST /api/gm/database/restore` with a backup name or an uploaded `.db`.
- The restore must:
  1. take a safety backup first;
  2. validate the file (SQLite header, `PRAGMA integrity_check`, expected tables);
  3. swap the DB file and reopen the better-sqlite3 connection, or restart.
- Front: a GM page section with the backup list, a "Restore" button and a typed confirmation.

---

## 1. Combat tracker (top priority feature)

### [x] 1.1 Combat tracker

- **Goal:** run combats at the table: initiative order, rounds/turns, HP/SP/RP, conditions.
- **Participants:**
  - Players (Starfinder sheets): stats from `character_sheets` JSON, computed with `calcStarfinder` / `skillBreakdown` in front `src/utils/starfinder-calc.ts`. The fields used are initiative, EAC/KAC, staminaTotal/hpTotal/resolveTotal and saves.
  - Monsters from the bestiary (`monsters`); add the same monster several times (Goblin 1, Goblin 2…).
  - Ad-hoc NPCs/creatures with a name and a few numbers.
- **Features:**
  - Roll initiative (d20 + bonus) or type it in.
  - Sort the order, show the current turn and the round counter, next/previous turn.
  - Damage/heal: Starfinder damage hits SP first, then HP; RP is spent separately.
  - Conditions with duration in rounds (off-target, flat-footed, prone…) that count down on each turn.
  - Combat log.
- **Persistence:**
  - New `encounters` table (state as JSON, linked to an optional `session_id`), GM-only.
  - Writing the damage back into the player's sheet (`staminaCurrent`/`hpCurrent`/`resolveCurrent`) must be an explicit "Apply to sheets" action.
- **Optional:** a read-only player view showing the order and whose turn it is, without monster HP. It needs polling or SSE.
- **UI:** a desktop/tablet-first layout with a usable phone layout; reuse `EntityCard` / `MobileCard`.

---

**Done (2026-10-19):** GM → Combat (`/gm/combat`). Back: `encounters` table + `/api/gm/encounters` (optimistic `version`, 409 on stale saves). Front: `src/pages/gm/combat/` (engine, `useEncounterSync` autosave + localStorage recovery + conflict choice). E2E-tested in Chrome (reload, offline + closed tab, two devices, phone layout).

Follow-ups (not approved yet):

- [x] Combat stats on bestiary entries: `monster_stat_blocks` (GM-only), 63 stat blocks from the Bestiário de Motávia book (`scripts/bestiary/`). 17 older entries (subterranean/aquatic/useful wildlife) have no stat block in the book yet.
- [ ] Read-only player view of the initiative order.

## 2. Living wiki

### [x] 2.1 Entity links in Markdown: `[[Piata]]`, `[[Rook]]`

- Extend front `RichText` (`src/components/common/RichText/`) with a remark plugin that resolves `[[Name]]` and `[[Name|label]]` against an entity index (cities, NPCs, players, dungeons, quests, lore, wiki, monsters, sessions).
- The index:
  - comes from a backend endpoint `GET /api/links/index`;
  - is visibility-filtered, so a hidden entity renders as plain text for players and never leaks its name or id;
  - is cached on the client.
- A link opens that entity's drawer or route.
- **"Appears in…"**:
  - The backend extracts `[[...]]` references when an entity is saved and stores them in a `entity_links` table (source type/id → target type/id).
  - The EntityDrawer gets an "Appears in" section listing the sources, visibility-filtered.
- Add an editor helper: autocomplete after typing `[[`.

### [x] 2.2 Automatic session diary

- In a session, the GM types loose bullet points; one action turns them into a Markdown summary, with links to the NPCs, cities and quests mentioned (uses 2.1).
- Step 1, no AI: detect entity names from the 2.1 index and wrap them in `[[ ]]`, and format the notes into sections.
- Step 2, optional: an AI summary. It needs an API key in env (`src/infra/config/env.ts`) and an adapter under `infra/`. **Ask the owner about cost before adding it.**
- The GM always reviews and edits the result before saving.

### [x] 2.3 Timeline linked to sessions and quests

- Link `timeline_events` to sessions, quests, cities and NPCs: either M:N tables or the 2.1 `entity_links`.
- On a city, NPC or quest drawer, add a "History" tab listing related events and sessions in chronological order, to answer "what already happened in Piata?".

---

**Done (2026-10-19):** `[[Name]]` / `[[Name|label]]` / `[[npc:Name]]` links render in every RichText and open a preview drawer (EntityPeekHost); a global `[[` autocomplete works in any textarea (GM). "Appears in" and "History" are computed on demand (`GET /api/links/:type/:id`, explicit links + plain-name mentions, visibility-filtered) and shown as drawer tabs via `EntityDrawer linkRef`. Session diary: GM tab "Diary" in sessions with autosaved notes, free "Format & link", and "Summarize with AI" (Anthropic, `ANTHROPIC_API_KEY`, rate-limited) — the GM reviews before it replaces the summary. AI is used only there.

## 3. Players

### [x] 3.1 Player progression: XP and credits per session

- New `player_progress` table: `player_id`, `session_id`, `xp`, `credits`, `note`, timestamps.
- When closing a session, the GM gives XP and credits to each player in one form.
- The player drawer gets a "Progress" tab with the history and totals. Optionally update the Starfinder sheet's `xpEarned` / `credits`.

---

**Done (2026-10-19):** `player_progress` table; `GET /api/players/:id/progress` (players see visible players, hidden session titles blanked), `GET|PUT /api/gm/sessions/:id/rewards` (idempotent per session). Front: session GM tab "Rewards" (bulk XP/credits, optional delta write to the Starfinder sheet with the same name) and player tab "Progress" (totals + history, visible to everyone).

## 4. Navigation and prep

### [x] 4.1 Global search (Ctrl+K / Cmd+K)

- Backend: `GET /api/search?q=` across NPCs, cities, dungeons, monsters, players, quests, sessions, lore, wiki, timeline, plus GM notes for the GM only. Visibility-filtered.
- SQLite FTS5 is a good fit; a `LIKE` search is enough for the current data size.
- Front: a command palette modal available everywhere, with keyboard navigation and results grouped by type. On mobile, open it from a header search icon.

**Done (2026-10-19):** `GET /api/search?q=` reuses the link repository (same visibility rules; GM notes for the GM only). Names/subtitles match word beginnings, body text whole words; names rank first. Front: Ctrl/Cmd+K palette (SearchPaletteHost) plus a search button in the desktop and mobile headers; results open in the entity preview drawer.

### [x] 4.2 Quick generators (GM only)

- **Name generator:** per world/culture (Motavian, Dezorian, Palman, Esper…), with editable word lists.
- **NPC generator:** name, race, job, trait, hook. "Save as NPC" creates it **hidden** (`visible=false`).
- **Shop generator:** stock and prices based on the Motavia economy imported into the wiki (category "Economia", some pages hidden). Parse or curate the price tables into JSON.
- **Encounter generator:** by party level, using bestiary entries.
- Start client-side with data files; persist only the saved results.

---

**Done (2026-10-19), front only:** GM → Generators (`src/generators/`): NPC, names (6 peoples), shop, encounter (opens in the combat tracker), Guild board. Seeded RNG + Markov + templates + per-device anti-repeat history. Shop stock = AoN Starfinder items curated for post-collapse Algol (`scripts/generators/curate.py`, 906 of 3,745 kept) + local goods with economy prices. Next: keep growing the data tables from new wiki pages.

### [x] 4.3 Item catalogue (canon v1.0) + loot generator

**Done (2026-10-19):** new `items` entity (table created at boot). One row per item with player fields (name, Motávia name, description, rules, level, region, local price) and GM fields (canon access, reference price, channel, loot sites, shops, policies, audit flags, GM notes, audit blob, visibility, status).

- Players: `GET /api/items` and `/api/items/:id` return only `visibility=public` **and** `status=published` items, through an explicit field whitelist (`toPlayerItem`). Tests check that no GM field leaks. Global search lists items with the same rule.
- GM: `/api/gm/items` CRUD and `POST /api/gm/items/import` (upsert by `code`, up to 200 per call).
- Front: Tools → Items (player catalogue); GM Area → Items catalogue (filters, bulk publish, editor with Player/GM/Audit tabs, homebrew creation).
- Generators read the catalogue: shop stock follows canon access (free anywhere, made-to-order in specialist shops and big cities, occasional offers only on the grey market; institutional and relic never). The GM can remove or add lines and scale prices before saving. New **Loot** tab: SEED facility, orbital satellite, cave, old cellar; items come from each item's `loot` sites near the party level.
- Seed: `scripts/items/items.seed.json`, **gitignored** because it carries GM-only notes and the repo is public; master copy in OneDrive `RPG/Itens/Seed/` (1,014 audited items + 10 artisan armours proposed under P_ARMADURA). 389 published on day one (public, sold freely or to order in Motávia). Rebuild with `scripts/items/build_seed.py`.

**Production seeding (after deploy):**

```bash
SEED_FILE=<path to items.seed.json> API_URL=https://<api host> ORIGIN=https://rpg.picho.org CLIENT_SECRET=<client secret> GM_API_KEY=<gm key> npm run items:seed
```

Run `DRY_RUN=1 npm run items:seed` first to see the batches. Re-running updates items by code, so it overwrites edits the GM made to seeded items.

## Backlog / housekeeping (offered, not yet approved)

- [ ] Delete the 5 orphan player-sheet PDFs in the Blob (3 are truncated at exactly 30 MiB). **Ask before deleting.**
- [ ] "Mesa mode" (one screen for live play) and "reveal with one click". These were proposed but not selected yet.
- [ ] Rykros world theme, in the future (Palma was destroyed: no Palma theme).
