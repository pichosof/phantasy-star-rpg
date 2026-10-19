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

### [ ] 1.1 Combat tracker

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

## 2. Living wiki

### [ ] 2.1 Entity links in Markdown: `[[Piata]]`, `[[Rook]]`

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

### [ ] 2.2 Automatic session diary

- In a session, the GM types loose bullet points; one action turns them into a Markdown summary, with links to the NPCs, cities and quests mentioned (uses 2.1).
- Step 1, no AI: detect entity names from the 2.1 index and wrap them in `[[ ]]`, and format the notes into sections.
- Step 2, optional: an AI summary. It needs an API key in env (`src/infra/config/env.ts`) and an adapter under `infra/`. **Ask the owner about cost before adding it.**
- The GM always reviews and edits the result before saving.

### [ ] 2.3 Timeline linked to sessions and quests

- Link `timeline_events` to sessions, quests, cities and NPCs: either M:N tables or the 2.1 `entity_links`.
- On a city, NPC or quest drawer, add a "History" tab listing related events and sessions in chronological order, to answer "what already happened in Piata?".

---

## 3. Players

### [ ] 3.1 Player progression: XP and credits per session

- New `player_progress` table: `player_id`, `session_id`, `xp`, `credits`, `note`, timestamps.
- When closing a session, the GM gives XP and credits to each player in one form.
- The player drawer gets a "Progress" tab with the history and totals. Optionally update the Starfinder sheet's `xpEarned` / `credits`.

---

## 4. Navigation and prep

### [ ] 4.1 Global search (Ctrl+K / Cmd+K)

- Backend: `GET /api/search?q=` across NPCs, cities, dungeons, monsters, players, quests, sessions, lore, wiki, timeline, plus GM notes for the GM only. Visibility-filtered.
- SQLite FTS5 is a good fit; a `LIKE` search is enough for the current data size.
- Front: a command palette modal available everywhere, with keyboard navigation and results grouped by type. On mobile, open it from a header search icon.

### [ ] 4.2 Quick generators (GM only)

- **Name generator:** per world/culture (Motavian, Dezorian, Palman, Esper…), with editable word lists.
- **NPC generator:** name, race, job, trait, hook. "Save as NPC" creates it **hidden** (`visible=false`).
- **Shop generator:** stock and prices based on the Motavia economy imported into the wiki (category "Economia", some pages hidden). Parse or curate the price tables into JSON.
- **Encounter generator:** by party level, using bestiary entries.
- Start client-side with data files; persist only the saved results.

---

## Backlog / housekeeping (offered, not yet approved)

- [ ] Delete the 5 orphan player-sheet PDFs in the Blob (3 are truncated at exactly 30 MiB). **Ask before deleting.**
- [ ] "Mesa mode" (one screen for live play) and "reveal with one click". These were proposed but not selected yet.
- [ ] Rykros world theme, in the future (Palma was destroyed: no Palma theme).
