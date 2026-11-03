# Picho-RPG · Back-end

> Fastify + Drizzle + SQLite API powering the [Picho-RPG](https://picho.org) tabletop companion, with a Discord bot, AI helpers and a combat tracker built in.

<p>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-blue.svg" /></a>
  <img alt="Node" src="https://img.shields.io/badge/Node-22-339933?logo=nodedotjs&logoColor=white" />
  <img alt="Fastify" src="https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white" />
  <img alt="Drizzle" src="https://img.shields.io/badge/Drizzle-ORM-C5F74F?logoColor=white" />
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white" />
  <img alt="discord.js" src="https://img.shields.io/badge/discord.js-14-5865F2?logo=discord&logoColor=white" />
  <img alt="Status" src="https://img.shields.io/badge/status-active-success" />
</p>

This repository hosts the **HTTP API**, the persistence layer and the **Discord bot** of [Picho-RPG](https://picho.org). It pairs with the web client [`phantasy-star-rpg.front`](https://github.com/pichosof/phantasy-star-rpg.front) (React 19 + Vite). The backend is intentionally small: one Node process, SQLite on disk, optional Azure Blob storage for uploads. It runs anywhere from `localhost` to an Azure Container App.

---

## Why this stack?

- **Fastify 5**: fast, schema-first, plugin-driven. Zod (via `fastify-type-provider-zod`) validates inputs and types the route handlers from the same schema.
- **Drizzle + better-sqlite3**: no database server, no SaaS dependency. The whole campaign is one file under `data/app.db`, backed up automatically.
- **Pluggable storage**: uploads live on local disk or in Azure Blob. The frontend always reads through `/files/*`, so swapping drivers is invisible.
- **JWT-based GM mode**: a single `GM_API_KEY` issues short-lived JWTs after a brute-force-aware unlock. Player and GM views come from the same endpoints, filtered by audience.
- **Hexagonal layering**: `core/` is framework-free (entities, ports, use-cases). `infra/` holds Fastify, Drizzle, storage, Discord and the AI adapters. `di/` wires them. The site and the Discord bot run the same use-cases.

---

## Features

### Campaign data

- ⚔️ **Domain CRUD** for worlds, cities, dungeons, NPCs, bestiary, players, character sheets, quests, sessions, timeline events, lore, wiki pages, tags, map markers, GM notes and GM images.
- 👁️ **Player vs GM visibility**: hidden and undiscovered entities are stripped from every non-GM response by one plugin. GM-only fields (like an NPC's **GM secret**) never reach players, not even through search or tag pages.
- 🔗 **Wiki-style links**: Markdown text can reference any entity with `[[Piata]]`, `[[Rook|the soldier]]` or `[[npc:Rook]]`. A link index powers "Appears in" backlinks and the global **search** (`/api/search`).
- 🧭 **Player progress**: session rewards (XP and credits, with a note) are recorded per player, and each player gets a progress history.
- 📦 **Item catalogue**: canon items with a strict whitelist of player-facing fields. Access, prices, loot tables and GM notes stay GM-only. The catalogue can be seeded or bulk-imported.
- 🐉 **Stat blocks**: Starfinder stat blocks per bestiary entry (GM-only), importable from JSON.

### GM tools

- 🗡️ **Combat tracker**: initiative order, Starfinder damage (Stamina first, then Hit Points), conditions with round counters and an action log. Encounters are saved server-side with optimistic concurrency, so the site and Discord can act on the same fight.
- 🎨 **AI NPC portraits** (optional, [Fotor](https://www.fotor.com/) API): the GM drafts a prompt from a style profile, a per-race profile with reference images and the NPC's description, edits it, and generates. Fotor calls back a secret webhook; the finished image is copied into our storage and kept in a per-NPC history.
- 📝 **AI session diary** (optional, Anthropic API): turns the GM's raw session notes into a Markdown summary that links the entities it mentions. The GM reviews it before it is saved.
- 💾 **Database backups**: automatic SQLite backups (on boot, on an interval and on shutdown) with retention, plus GM endpoints to download, back up now, list and restore (a safety backup is taken first).

### Discord bot (optional)

Slash commands registered in one or more servers, answering from the same use-cases as the site:

| Audience      | Commands                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Everyone      | `/roll`, `/oracle`, `/lookup`, `/item`, `/session`, `/timeline`, `/combat`, `/help`            |
| Linked player | `/me`, `/check`, `/save`, `/init`, `/attack`, `/progress`, `/quests`                           |
| GM            | `/link`, `/reveal`, `/encounter next\|damage\|heal\|condition\|clear\|out`, `/say`, `/handout` |

- Public answers always use the **player view**, even when the GM asks. The GM's full view is ephemeral.
- Dice expressions support `1d20+5`, `4d6kh3`, `2d20kl1 + 1d4 + 2`. The oracle answers yes/no questions with "and"/"but" twists.
- Revealing an entity on the site can announce it in a channel. A posted `/combat` board updates live and pings the player whose turn starts.
- `/say` speaks as an NPC (with their portrait) through a channel webhook; `/handout` sends an entry, a note or an image by DM.

### Platform

- 📚 **Library** with format-aware uploads (PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, EPUB, MOBI, TXT, MD, CSV, ZIP) and **automatic MOBI → EPUB conversion** via Calibre.
- 🖼️ **Image thumbnails**: `GET /files/<key>?w=320|640|1280` returns a resized WebP, generated on first request and cached in storage. A per-image **focal point** keeps the subject in frame on cropped cards.
- 🗄️ **Pluggable file storage** (local disk or Azure Blob) behind the same `/files/*` URL contract. Storage keys that try to leave the storage root are refused.
- 🔒 **Security defaults**: Helmet (strict CSP), per-IP rate limit, CORS allow-list, client-secret check with Origin/Referer validation, MIME allow-list on uploads, 512 KB JSON limit, multipart size cap, constant-time key comparison.
- 📖 **OpenAPI** generated by `@fastify/swagger`, with Swagger UI at `/docs` outside production.
- 🧪 **Vitest** integration tests against a real SQLite test database.
- 🐳 **Containerised** and deployed to **Azure Container Apps** on every push to `main`, with a cost guard that scales to zero when the monthly budget runs out.

---

## Stack

| Layer         | Tech                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| Runtime       | Node.js 22 (`type: module`)                                                                                |
| Web framework | Fastify 5 + `@fastify/cors`, `helmet`, `multipart`, `rate-limit`, `static`, `swagger`, `swagger-ui`, `jwt` |
| Validation    | Zod 4 + `fastify-type-provider-zod` + `zod-to-json-schema`                                                 |
| ORM           | Drizzle ORM (`drizzle-orm` + `drizzle-kit`)                                                                |
| Database      | SQLite via `better-sqlite3`                                                                                |
| Storage       | Local FS or `@azure/storage-blob`; thumbnails with `sharp`                                                 |
| Discord       | `discord.js` 14 (slash commands, webhooks, live messages)                                                  |
| AI (optional) | Anthropic Messages API (session diary), Fotor OpenAPI (NPC portraits)                                      |
| Logging       | Pino (`pino-pretty` in dev)                                                                                |
| Auth          | JWT (`@fastify/jwt`) + brute-force-aware key unlock                                                        |
| Testing       | Vitest (dedicated test DB under `data/test.db`)                                                            |
| Lint / format | ESLint 9 (flat config) + Prettier 3, enforced by a pre-commit hook                                         |
| Build         | TypeScript 6 → ESM, post-build path fixer (`scripts/fix-dist-imports.mjs`)                                 |

---

## Quick start

### Requirements

- Node.js **22**
- npm (the lockfile is maintained with the npm that ships with Node 22)
- (Optional) [Calibre](https://calibre-ebook.com/download) for `.mobi` → `.epub` conversion. Without it, MOBI uploads are stored as-is and the frontend offers a download instead of a viewer.

### Install & run

```bash
cp .env.example .env       # then edit values
npm install
npm run drizzle:migrate    # apply SQL migrations to data/app.db
npm run dev                # tsx watch on src/app.ts
```

The dev server listens on `http://localhost:3010` by default. Swagger UI: `http://localhost:3010/docs`.

The Discord bot, the AI diary and the portraits stay **off** until their variables are set, so a plain checkout runs with only the core variables.

### Available scripts

| Script                               | Description                                                       |
| ------------------------------------ | ----------------------------------------------------------------- |
| `npm run dev`                        | `tsx watch src/app.ts`: restarts on file changes.                 |
| `npm run build`                      | TypeScript build to `dist/` + import path fix.                    |
| `npm start`                          | Run the compiled `dist/app.js`.                                   |
| `npm run drizzle:generate`           | Generate a new SQL migration from the schema.                     |
| `npm run drizzle:migrate`            | Apply pending migrations to the configured database.              |
| `npm run lint` / `npm run lint:fix`  | ESLint over the project.                                          |
| `npm run format`                     | Prettier on the whole repo.                                       |
| `npm test` / `npm run test:run`      | Vitest in watch / single-run mode (uses `data/test.db`).          |
| `npm run test:cov`                   | Vitest with coverage (V8).                                        |
| `npm run check`                      | Lint + build + test (the same gate CI runs).                      |
| `npm run items:seed`                 | Seed the item catalogue of a fresh environment.                   |
| `npm run release`                    | Check, push and watch the production deploy of back and/or front. |
| `npm run storage:migrate:azure-blob` | Copy existing local uploads to Azure Blob (one-shot).             |

### Environment variables

Read once at boot by [`src/infra/config/env.ts`](src/infra/config/env.ts). The core ones are in [`.env.example`](.env.example).

**Core**

| Variable                          | Default          | Purpose                                                                 |
| --------------------------------- | ---------------- | ----------------------------------------------------------------------- |
| `PORT`                            | `3010`           | HTTP port.                                                              |
| `NODE_ENV`                        | `development`    | `development` / `production` / `test`; toggles logging and hardening.   |
| `DATABASE_URL`                    | `./data/app.db`  | Path to the SQLite file.                                                |
| `CORS_ORIGIN`                     | `*`              | Comma-separated origin allow-list. Set to your frontend origin in prod. |
| `FILE_STORAGE_DRIVER`             | `local`          | `local` or `azure-blob`.                                                |
| `UPLOADS_LOCAL_DIR`               | `./data/uploads` | Where local uploads are stored (when `FILE_STORAGE_DRIVER=local`).      |
| `AZURE_STORAGE_CONNECTION_STRING` | empty            | Azure connection string (when `FILE_STORAGE_DRIVER=azure-blob`).        |
| `AZURE_STORAGE_CONTAINER`         | `uploads`        | Blob container name.                                                    |
| `AZURE_STORAGE_ACCESS_TIER`       | `Cool`           | Tier for new blobs (`Hot`, `Cool`, `Archive`).                          |
| `MAX_UPLOAD_MB`                   | `30`             | Multipart cap; must match `VITE_UPLOAD_MAX_MB` on the frontend.         |
| `GM_API_KEY`                      | —                | The shared GM key. Long, random.                                        |
| `CLIENT_SECRET`                   | —                | Shared secret with the frontend; must match `VITE_CLIENT_SECRET`.       |
| `JWT_SECRET`                      | —                | Signs the GM JWTs. Long, random, **rotate on compromise**.              |
| `JWT_EXPIRES_IN`                  | `8h`             | JWT TTL.                                                                |

**Backups**

| Variable                 | Default          | Purpose                                                       |
| ------------------------ | ---------------- | ------------------------------------------------------------- |
| `BACKUP_ENABLED`         | prod only        | Periodic SQLite backups (boot, every interval, and shutdown). |
| `BACKUP_INTERVAL_HOURS`  | `6`              | Interval between backups while the process is up.             |
| `BACKUP_RETENTION`       | `30`             | Number of backups kept; older ones are pruned.                |
| `AZURE_BACKUP_CONTAINER` | `db-backups`     | **Private** Blob container, never served by `/files/*`.       |
| `BACKUP_LOCAL_DIR`       | `./data/backups` | Backup target when the storage driver is `local`.             |

**Optional integrations** (empty = feature off)

| Variable                      | Default            | Purpose                                                               |
| ----------------------------- | ------------------ | --------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`           | empty              | Enables the AI session-diary summary.                                 |
| `ANTHROPIC_MODEL`             | `claude-haiku-5-5` | Model used for the summary.                                           |
| `DISCORD_TOKEN`               | empty              | Discord bot token. When set, every `DISCORD_*`/URL row is required.   |
| `DISCORD_GUILD_IDS`           | —                  | Servers where the slash commands are registered (comma-separated).    |
| `DISCORD_GM_USER_IDS`         | —                  | Discord user ids with GM powers in the bot (comma-separated).         |
| `DISCORD_ANNOUNCE_CHANNEL_ID` | —                  | Channel for reveal announcements; empty turns announcements off.      |
| `SITE_URL`                    | —                  | Front-end URL for the bot's "Open on site" links.                     |
| `PUBLIC_API_URL`              | —                  | Public API URL, to make uploaded images absolute (bot and portraits). |
| `FOTOR_API_KEY`               | empty              | Fotor OpenAPI key for NPC portraits.                                  |
| `FOTOR_WEBHOOK_SECRET`        | —                  | 24+ chars; last segment of the webhook URL `/hooks/fotor/<secret>`.   |

`GET /api/health` is the startup probe and never depends on Discord. `GET /api/health/discord` answers 200 when the bot is `ready` or deliberately `off`, and 503 with the reason otherwise.

---

## Storage

The backend supports two upload backends with the same public URL contract (`/files/<key>`).

### Local disk (default)

```env
FILE_STORAGE_DRIVER=local
UPLOADS_LOCAL_DIR=./data/uploads
```

Files land under `UPLOADS_LOCAL_DIR`. The directory is created automatically on boot.

### Azure Blob

```env
FILE_STORAGE_DRIVER=azure-blob
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=...
AZURE_STORAGE_CONTAINER=uploads
AZURE_STORAGE_ACCESS_TIER=Cool
```

The frontend never sees the difference: it keeps requesting `/files/<key>` and the backend streams from the chosen driver, with HTTP range support for large files.

To migrate existing local uploads to Azure Blob:

```bash
npm run storage:migrate:azure-blob
```

### Thumbnails and focal points

- `GET /files/<key>?w=320`, `640` or `1280` returns a WebP thumbnail, generated with `sharp` on first request and cached under `_thumbs/w<width>/<key>.webp`. Other widths fall back to the original; animated GIFs become their first frame.
- The GM can set a focal point per image (`PUT /api/gm/image-focus`); clients read it with `GET /api/image-focus?keys=…`, which only answers for keys the caller already has.

---

## 🔑 GM key

Picho-RPG has no user accounts. The split is simple: **everyone is a player by default**, and a single shared **GM key** unlocks the GM panel. There's one GM key per deployment.

### How to set it up

1. **Generate a strong key** (≥ 24 chars, mixing upper, lower, digits and symbols):

   ```bash
   # Linux / macOS / WSL
   openssl rand -base64 48

   # PowerShell
   [Convert]::ToBase64String([byte[]](1..48 | ForEach-Object { Get-Random -Maximum 256 }))
   ```

2. **Set it in the backend `.env`**:

   ```env
   GM_API_KEY=the-generated-string-here
   JWT_SECRET=another-long-random-string-here
   JWT_EXPIRES_IN=8h
   ```

3. **Restart the backend.** On boot, the auth plugin validates `GM_API_KEY`:
   - It must be at least **24 characters**.
   - It must contain at least **3 of these 4 classes**: uppercase, lowercase, digits, symbols.
   - In `NODE_ENV=production`, a weak key (or no key) **aborts boot**. In dev, it logs a warning so you can still iterate.

4. **Hand the key to the GM** out-of-band (DM, password manager, sealed envelope: your call). It is not exchanged anywhere else after the first unlock.

### How players / GM use it

The flow on the frontend:

1. The GM clicks the GM toggle in the settings dropdown and pastes the key.
2. The frontend sends `POST /api/auth/login` with `{ "apiKey": "<the-key>" }`.
3. The backend compares it with `safeCompare()` (constant-time) against `GM_API_KEY`, throttles per IP via the brute-force tracker, and on success issues a JWT signed with `JWT_SECRET`.
4. The frontend stores the JWT and sends it as `Authorization: Bearer <jwt>` on every subsequent request.
5. GM-only routes (under `/api/gm/*`, uploads, edits, visibility changes) check the JWT via the `requireGM` pre-handler.

On Discord, GM powers come from `DISCORD_GM_USER_IDS` instead of the key.

**Public API:**

```http
POST /api/auth/login
Content-Type: application/json

{ "apiKey": "the-gm-key" }
```

Successful response:

```json
{
  "token": "eyJhbGciOi…",
  "expiresAt": "2026-04-29T03:14:15.000Z"
}
```

Failures:

- `401 Unauthorized`: wrong key. The brute-force tracker records the failure.
- `429 Too Many Requests`: IP is in lockout. The response includes a `Retry-After` header and a `retryAfterSeconds` field.

### Brute-force protection

`src/infra/security/brute-force.ts` keeps an in-memory tracker per IP. After consecutive failures the tracker locks the IP for a backoff period; successful unlocks clear the counter. The state is **per-process**: if you scale horizontally, swap the implementation for a shared store (Redis, Azure Table) before exposing the API publicly.

### Rotation

To rotate the GM key, replace `GM_API_KEY` in the deploy environment and restart the backend. All in-flight JWTs remain valid until expiry; to invalidate them immediately too, also rotate `JWT_SECRET` (this kicks every authenticated GM out).

### Things to avoid

- **Don't commit `.env`.** The repository's `.gitignore` excludes it. The `.env.example` lists the core variables.
- **Don't put the GM key in client code.** It only lives in the backend env. The browser only ever sees the JWT.
- **Don't use the same value for `GM_API_KEY` and `CLIENT_SECRET`.** The first authenticates the GM; the second is a shared sanity check that the request comes from a Picho-RPG client.
- **Don't skip the JWT.** Every GM request must include `Authorization: Bearer <jwt>`. The unlock endpoint is the only one that accepts the raw key.

---

## Discord bot

The bot is a driving adapter that lives in the API process ([`src/infra/discord/`](src/infra/discord/)). It turns on when `DISCORD_TOKEN` is set, and then every `DISCORD_*` variable plus `SITE_URL` and `PUBLIC_API_URL` becomes required.

1. Create an application and a bot in the [Discord Developer Portal](https://discord.com/developers/applications) and invite it with the `applications.commands` and `bot` scopes. `/say` also needs the **Manage Webhooks** permission in the channel.
2. Set the variables, start the API, and the slash commands are registered in every server listed in `DISCORD_GUILD_IDS`.
3. The GM links each player to their character with `/link` (Discord user → player + Starfinder sheet). From then on `/check`, `/save`, `/init` and `/attack` roll from that sheet.

Design rules worth knowing before changing a command:

- **No guessing.** Typed names must match exactly and uniquely; otherwise the user picks from suggestions. A value a roll needs that is missing from the sheet is an error, never an assumed default.
- **Only expected errors are caught** (not found, expired interaction, deleted message). Everything else surfaces.
- Handlers are plain functions that return Discord API JSON, so they are tested without a Discord connection (`tests/discord*.test.ts`).
- The sheet math ([`starfinder.ts`](src/core/use-cases/character-sheets/starfinder.ts)) and the combat rules ([`combat-engine.ts`](src/core/use-cases/encounters/combat-engine.ts)) mirror files in the frontend. Change both together.

The bot needs the process to stay up, so the production deploy keeps `minReplicas=1` while the budget allows it (see [Production CD](#production-cd)).

---

## AI features

Both are optional and GM-only. Leaving their keys empty turns them off, and the frontend hides the related buttons (`GET /api/gm/ai/status`, `GET /api/gm/portraits/status`).

### Session diary (Anthropic)

`POST /api/gm/sessions/:id/diary/summarize` sends the GM's notes for a session to the model set in `ANTHROPIC_MODEL` and returns a Markdown summary. It links known entities as `[[Name]]`. The summary is a draft: nothing is saved until the GM accepts it.

### NPC portraits (Fotor)

1. **Profiles** (`/api/gm/portrait-profiles`): one `style` profile plus one profile per race, each with a prompt and optional reference images. They are campaign data and live in the database, never in the repo.
2. **Draft** (`POST /api/gm/npcs/:id/portrait/draft`): builds a prompt from the style, the NPC's race profile and the NPC text. Lines the GM marked as private are left out.
3. **Generate** (`POST /api/gm/npcs/:id/portraits`): the GM edits the prompt and submits. Each request is a `portrait_jobs` row.
4. **Webhook** (`POST /hooks/fotor/<FOTOR_WEBHOOK_SECRET>`, outside `/api`): Fotor calls it for every task of the account. The hook only says "look at task X"; the API then asks Fotor with its own key, so unknown or forged task ids do nothing.
5. The finished image is copied into our storage (Fotor results expire after 90 days) and becomes the portrait. Earlier pictures stay in the history (`apply` switches back), and `check` retries a failed copy without paying for a new image.

Register the webhook URL in the Fotor dashboard after the first deploy with `FOTOR_WEBHOOK_SECRET` set.

---

## Database backups

Implementation: [`src/infra/backup/`](src/infra/backup/).

- With `BACKUP_ENABLED`, a consistent SQLite snapshot is written on boot, every `BACKUP_INTERVAL_HOURS` and on `SIGTERM`. It is skipped when nothing changed, and only the newest `BACKUP_RETENTION` copies are kept.
- Backups go to the private `AZURE_BACKUP_CONTAINER` (Azure) or `BACKUP_LOCAL_DIR` (local). They are never reachable through `/files/*`.
- GM endpoints:

  | Endpoint                               | What it does                                                    |
  | -------------------------------------- | --------------------------------------------------------------- |
  | `GET /api/gm/database/download`        | Streams a fresh snapshot.                                       |
  | `POST /api/gm/database/backup`         | Backs up now.                                                   |
  | `GET /api/gm/database/backups`         | Lists stored backups, newest first.                             |
  | `POST /api/gm/database/restore`        | Restores a stored backup by name (typed confirmation required). |
  | `POST /api/gm/database/restore/upload` | Restores from an uploaded `.db` file.                           |

  A restore always takes a safety backup of the current database first.

---

## Calibre (MOBI → EPUB)

When a `.mobi` file is uploaded to the Library, the backend tries to convert it to EPUB using Calibre's `ebook-convert` CLI so the in-browser viewer can render it. If Calibre is not installed, the file is stored as-is and users fall back to downloading it.

<details>
<summary><strong>Install Calibre on Windows</strong></summary>

1. Download and install from <https://calibre-ebook.com/download_windows>.
2. Add the install directory to the system `PATH` (default `C:\Program Files\Calibre2\`).
3. Restart your terminal and verify:
   ```bash
   ebook-convert --version
   ```

</details>

<details>
<summary><strong>Install Calibre on Linux (Debian/Ubuntu)</strong></summary>

```bash
sudo apt install calibre
```

</details>

<details>
<summary><strong>Install Calibre on macOS</strong></summary>

```bash
brew install calibre
```

</details>

---

## Project layout

```
phantasy-star-rpg
├── src/
│   ├── app.ts                          Server bootstrap
│   ├── core/                           Framework-agnostic domain
│   │   ├── entities/                   Plain TS classes (Player, City, NPC, …)
│   │   ├── events/                     Domain events (revealed, encounterSaved)
│   │   ├── repositories/               Repository interfaces (ports)
│   │   └── use-cases/                  Application logic, one folder per domain
│   │                                   (encounters, items, portraits, dice, links, …)
│   ├── infra/
│   │   ├── config/env.ts               Env parsing + defaults (the only reader of process.env)
│   │   ├── db/{index,schema}.ts        Drizzle setup + tables
│   │   ├── repositories/               Drizzle implementations of the ports
│   │   ├── storage/                    File storage adapters, thumbnails, key safety
│   │   ├── backup/                     SQLite backup / restore
│   │   ├── discord/                    Bot, slash command definitions and handlers
│   │   ├── ai/                         Anthropic and Fotor adapters
│   │   ├── security/                   Brute-force tracker, key hashing, safe compare
│   │   └── http/
│   │       ├── server.ts               Plugin registration + route mounting
│   │       ├── plugins/                Auth, client auth, error handler, swagger, visibility filter
│   │       ├── controllers/            Per-domain Fastify handlers
│   │       └── routes/                 Per-domain route declarations (Zod schemas)
│   ├── di/container.ts                 Manual DI container (use-case ↔ repo wiring)
│   └── types/                          Shared TS types
├── drizzle/migrations/                 Generated SQL migrations
├── scripts/
│   ├── fix-dist-imports.mjs            Adds .js extensions after the tsc build (ESM-correct)
│   ├── release.mjs                     One-command release for back + front
│   ├── items/                          Item catalogue seed
│   ├── bestiary/                       Stat block import
│   └── migrate-uploads-to-azure-blob.ts
├── tests/                              Vitest suites + setup
├── deploy/azure/                       Container App template
├── Dockerfile                          Multi-stage build (Node 22 slim)
├── drizzle.config.ts                   Drizzle Kit config
├── eslint.config.cjs                   Flat ESLint config
├── tsconfig.json
└── vitest.config.ts
```

---

## Architecture highlights

- **Hexagonal layering.** `core/` defines what the app does; `infra/` defines how. The DI container in `src/di/container.ts` wires concrete implementations to the use-cases. The HTTP API and the Discord bot are two driving adapters over the same use-cases.
- **One controller per domain** under `src/infra/http/controllers/`, paired with a route declaration that wires Zod schemas in `src/infra/http/routes/`.
- **GM gate.** GM-only endpoints use `app.withGM()`; player endpoints don't. The unlock endpoint validates the key, applies the brute-force tracker and issues a JWT.
- **Visibility filter.** A `preSerialization` hook trims hidden and undiscovered entities, and GM-only fields, from every non-GM response. The same endpoint serves both audiences without leaking.
- **Domain events.** Revealing an entity publishes `revealed`; saving an encounter publishes `encounterSaved`. The Discord adapter listens to post announcements and refresh live combat boards.
- **Schema-first.** Every route declares a Zod schema; the type provider types `req.body`/`req.query`/`req.params`, and `@fastify/swagger` builds the OpenAPI spec from the same source.
- **Runtime DDL for additive changes.** Production does not run migrations, so new tables and columns are added at boot with `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE … ADD COLUMN` when missing.

For deeper guidance (repository conventions, where to add a new entity, the library pipeline, gotchas), see [`AGENTS.md`](AGENTS.md).

---

## Deployment

The repo ships a multi-stage `Dockerfile` and an Azure Container Apps deploy pipeline.

```bash
# Build the image locally
docker build -t picho-rpg-backend .

# Run with a mounted data dir
docker run -p 3010:3010 \
  -e GM_API_KEY=... -e JWT_SECRET=... -e CLIENT_SECRET=... \
  -v $(pwd)/data:/app/data \
  picho-rpg-backend
```

For Azure Container Apps:

- Logs go to stdout (Pino JSON in prod).
- Persistent disk goes via an Azure Files volume mounted at `/app/data`.
- Set `FILE_STORAGE_DRIVER=azure-blob` to push uploads to Blob instead of the volume.

### Production CD

[`deploy-production.yml`](.github/workflows/deploy-production.yml) deploys every push to `main` to Azure Container Apps:

- A validation job runs lint, build and tests on Node 22 first; nothing is deployed if it fails.
- Azure login uses GitHub OIDC with an Azure identity federated to this repository's `main` branch.
- The image is tagged with `${GITHUB_SHA}` and pushed to GitHub Container Registry (`ghcr.io/<owner>/<repo>`) using the built-in `GITHUB_TOKEN`.
- The GHCR package must be **public**: Container Apps pulls the image without registry credentials. The workflow checks this before deploying and fails without touching the running revision if the package is private.
- Secrets stay in Azure Container Apps and are referenced as `secretref:*`; secret values are never stored in the repository.
- After the update, the workflow waits until `/api/health` reports the deployed commit, and checks `/api/health/discord` according to `DISCORD_ENABLED`.

[`cost-guard.yml`](.github/workflows/cost-guard.yml) runs every 6 hours. While the resource group's month-to-date cost stays under the budget (R$ 50, minus a R$ 3 margin for billing lag), the API keeps `minReplicas=1` so the Discord bot stays online. Above it, the API drops to `minReplicas=0` (cold starts). The month-to-date cost resets on the 1st, which switches it back on. Throttled cost queries (HTTP 429) are retried with backoff.

Required GitHub Actions secrets:

| Secret name                            | Purpose                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `AZURE_CLIENT_ID`                      | OIDC-enabled Azure identity client ID.                                                   |
| `AZURE_TENANT_ID`                      | Azure tenant ID.                                                                         |
| `AZURE_SUBSCRIPTION_ID`                | Azure subscription ID.                                                                   |
| `AZURE_RESOURCE_GROUP`                 | Resource group that owns the API resources.                                              |
| `AZURE_CONTAINER_APP_NAME`             | Azure Container Apps API resource name.                                                  |
| `API_HEALTH_URL`                       | Production health-check URL.                                                             |
| `API_PORT`                             | API container port.                                                                      |
| `NODE_ENV`                             | Runtime environment name.                                                                |
| `DATABASE_URL`                         | Database path/URL used by the container.                                                 |
| `CORS_ORIGIN`                          | Allowed production frontend origin.                                                      |
| `FILE_STORAGE_DRIVER`                  | Upload storage driver.                                                                   |
| `UPLOADS_LOCAL_DIR`                    | Local upload mount path used by the container.                                           |
| `AZURE_STORAGE_CONTAINER`              | Blob container name.                                                                     |
| `AZURE_STORAGE_ACCESS_TIER`            | Blob access tier.                                                                        |
| `MAX_UPLOAD_MB`                        | Upload cap in MB.                                                                        |
| `JWT_EXPIRES_IN`                       | GM JWT expiration window.                                                                |
| `AZURE_STORAGE_CONNECTION_SECRET_NAME` | Container App secret name for the storage connection.                                    |
| `CLIENT_SECRET_NAME`                   | Container App secret name for the frontend client secret.                                |
| `GM_API_KEY_SECRET_NAME`               | Container App secret name for the GM key.                                                |
| `JWT_SECRET_NAME`                      | Container App secret name for JWT signing.                                               |
| `DISCORD_TOKEN`                        | Discord bot token (copied into the Container Apps secret `discord-token` on deploy).     |
| `DISCORD_GUILD_IDS`                    | Discord servers where the slash commands are registered (comma-separated).               |
| `DISCORD_GM_USER_IDS`                  | Discord user ids with GM powers (comma-separated).                                       |
| `DISCORD_ANNOUNCE_CHANNEL_ID`          | Reveal announcements channel (empty = off).                                              |
| `SITE_URL`                             | Front-end URL for the bot's "Open on site" links.                                        |
| `PUBLIC_API_URL`                       | Public API URL, for the bot's image links and the portrait references.                   |
| `FOTOR_API_KEY`                        | Fotor OpenAPI key (copied into the Container Apps secret `fotor-api-key`).               |
| `FOTOR_WEBHOOK_SECRET`                 | Secret path segment of the Fotor webhook (Container Apps secret `fotor-webhook-secret`). |

Required repository **variables** (no defaults, so a missing value fails the deploy instead of guessing):

| Variable          | Values           | Effect                                                                                                           |
| ----------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `DISCORD_ENABLED` | `true` / `false` | `true` passes the `DISCORD_*` settings (all required) and waits for the bot to be `ready`; `false` removes them. |
| `FOTOR_ENABLED`   | `true` / `false` | `true` passes `FOTOR_API_KEY`, `FOTOR_WEBHOOK_SECRET` and `PUBLIC_API_URL` (all required); `false` removes them. |

---

## Contributing

PRs are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening one. By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

To report a security issue, **don't open a GitHub issue**: see [`SECURITY.md`](SECURITY.md).

---

## License

[MIT](LICENSE) © Jonathan Mendonça — picho.org
