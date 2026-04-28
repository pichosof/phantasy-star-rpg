# AGENTS.md · Picho-RPG · Back-end

> Single source of truth for AI agents and human contributors working on this codebase. Optimised to be **read once and remembered** — no fluff, lots of pointers.

If you're an LLM-driven agent, treat this file as your project briefing. The information here is dense by design: it should let you act without re-deriving conventions from scratch.

---

## 1. What is this?

Picho-RPG is a tabletop RPG companion app. This repo is the **HTTP API** and persistence layer (Fastify 5 + Drizzle + better-sqlite3). It pairs with a separate React/Vite front-end (`picho-rpg-front`) that consumes this API.

**Domain entities** (mirrored on the front-end):

| Entity           | Drizzle table        | Notes                                             |
| ---------------- | -------------------- | ------------------------------------------------- |
| World            | `worlds`             | Top-level container; cities link to a world.      |
| City             | `cities`             | Have lores, quests, dungeons, NPCs, images.       |
| Dungeon          | `dungeons`           | Locations within or near a city.                  |
| NPC              | `npcs`               | Named characters, optional portrait + PDF sheet.  |
| Monster          | `monsters`           | Bestiary entries.                                 |
| Player           | `players`            | Player at the table.                              |
| Character Sheet  | `character_sheets`   | GURPS / Starfinder JSON blob owned by a player.   |
| Quest            | `quests`             | Story arc/objective; M:N with cities and players. |
| Session          | `sessions`           | One play session.                                 |
| Timeline Event   | `timeline_events`    | Datable in-world event.                           |
| Lore             | `lores`              | Article; optionally city-scoped.                  |
| Wiki Page        | `wiki_pages`         | Markdown article.                                 |
| GM Note          | `gm_notes`           | Private GM-only note.                             |
| GM Image         | `gm_images`          | GM image gallery.                                 |
| Library Document | `library_documents`  | Shared rulebooks, PDFs, EPUBs, etc.               |
| Map Marker       | `map_markers`        | Position of a city/dungeon on the world map.      |
| Tag              | `tags` + join tables | Polymorphic tags via M:N joins.                   |

**Two visibility audiences**:

- **Player** (default). Public endpoints; hidden entities filtered out by `visibility-filter` plugin.
- **GM**. Authenticated via JWT obtained from the unlock endpoint. Sees everything.

---

## 2. Stack snapshot

| Layer         | Tech                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Runtime       | Node.js 20 (`type: module`)                                                                    |
| Web framework | Fastify 5                                                                                      |
| Plugins       | `@fastify/cors`, `helmet`, `multipart`, `rate-limit`, `static`, `swagger`, `swagger-ui`, `jwt` |
| Validation    | Zod 3 + `fastify-type-provider-zod` + `zod-to-json-schema`                                     |
| ORM           | Drizzle ORM (`drizzle-orm`) + Drizzle Kit                                                      |
| Database      | SQLite via `better-sqlite3`                                                                    |
| Storage       | Local FS (default) or Azure Blob (`@azure/storage-blob`)                                       |
| Logging       | Pino 9 (`pino-pretty` in dev)                                                                  |
| Auth          | JWT via `@fastify/jwt`                                                                         |
| Tests         | Vitest 3 + V8 coverage                                                                         |
| Lint / format | ESLint 9 (flat config) + Prettier 3                                                            |
| Build         | TypeScript 5.5 → ESM (post-build path fixer at `scripts/fix-dist-imports.mjs`)                 |
| Dev runner    | `tsx watch`                                                                                    |

---

## 3. Folder map

```
src/
├── app.ts                          Bootstrap. Creates data dirs, builds server, listens.
├── core/                           Framework-free domain layer
│   ├── entities/                   Plain TS classes (Player, City, NPC, …)
│   ├── repositories/               Repository interfaces (ports)
│   └── use-cases/                  Application logic, one folder per domain
│       ├── bestiary/
│       ├── character-sheets/
│       ├── cities/
│       ├── common/                 Cross-cutting: SetVisibility, …
│       ├── gm-images/
│       ├── gm-notes/
│       ├── lore/
│       ├── map-marker/
│       ├── npc/
│       ├── player/
│       ├── quest/
│       ├── session/
│       ├── timeline/
│       ├── wiki/
│       └── world/
├── infra/                          Adapters and frameworks
│   ├── config/env.ts               Env parsing + defaults (see "Environment").
│   ├── db/
│   │   ├── index.ts                Drizzle + better-sqlite3 client
│   │   └── schema.ts               All tables in one file
│   ├── repositories/               Drizzle implementations of the ports
│   ├── storage/
│   │   ├── file-storage.port.ts    Storage interface
│   │   ├── local-file.storage.ts   Local FS adapter
│   │   ├── azure-blob.file-storage.ts  Azure Blob adapter
│   │   ├── file-storage.utils.ts   Range parsing, key encoding
│   │   └── index.ts                Driver factory
│   ├── security/
│   │   ├── brute-force.ts          In-memory tracker for GM unlock
│   │   ├── key-hash.ts             Hashes GM_API_KEY for safe compare
│   │   └── safe-compare.ts         Constant-time string compare
│   └── http/
│       ├── server.ts               Plugin registration + route mounting
│       ├── plugins/
│       │   ├── auth.ts             JWT auth (registered on GM-only routes)
│       │   ├── client-auth.ts      Shared-secret check for browser clients
│       │   ├── error-handler.ts    Maps thrown errors → JSON responses
│       │   ├── swagger.ts          @fastify/swagger setup + `/docs`
│       │   └── visibility-filter.ts  Strips hidden entities for non-GM callers
│       ├── controllers/            One file per domain (handler functions)
│       └── routes/                 One file per domain (route declarations + Zod schemas)
├── di/container.ts                 Manual DI: wires use-cases ↔ repositories ↔ storage
└── types/                          Shared TS types
```

```
drizzle/
└── migrations/
    ├── 0000_initial.sql
    ├── 0001_xxx.sql
    └── meta/
```

```
scripts/
├── fix-dist-imports.mjs            Post-build: rewrites bare imports to use .js extension
├── migrate-uploads-to-azure-blob.ts  One-shot: copies local uploads to Blob
└── migrate-dungeons-tags.js        Historical data migration helper
```

```
tests/
├── setup.ts                        Resets the test DB between runs
└── *.test.ts                       Per-domain integration tests
```

---

## 4. How to run / test / build

```bash
npm install
npm run drizzle:migrate    # apply migrations to data/app.db
npm run dev                # tsx watch on src/app.ts (port 3010 by default)
npm run build              # compile to dist/, then run fix-dist-imports.mjs
npm start                  # node dist/app.js
npm run lint               # ESLint
npm run lint:fix           # ESLint + autofix
npm run format             # Prettier
npm test                   # Vitest watch (uses data/test.db)
npm run test:run           # Vitest single run
npm run test:cov           # Vitest with coverage (V8)
npm run check              # lint + build + test:run
```

Pre-commit hook runs `lint-staged` (ESLint + Prettier on touched files).

---

## 5. Environment variables

Read at boot from `.env` via `src/infra/config/env.ts`. Treated as required unless a default is provided:

| Variable                          | Default          | Purpose                                                            |
| --------------------------------- | ---------------- | ------------------------------------------------------------------ |
| `PORT`                            | `3010`           | HTTP port.                                                         |
| `NODE_ENV`                        | `development`    | `development` / `production` / `test`. Drives logging + behaviour. |
| `DATABASE_URL`                    | `./data/app.db`  | Path to the SQLite file.                                           |
| `CORS_ORIGIN`                     | `*`              | Origin allow-list.                                                 |
| `FILE_STORAGE_DRIVER`             | `local`          | `local` or `azure-blob`.                                           |
| `UPLOADS_LOCAL_DIR`               | `./data/uploads` | Path used when driver is `local`.                                  |
| `AZURE_STORAGE_CONNECTION_STRING` | empty            | Required when driver is `azure-blob`.                              |
| `AZURE_STORAGE_CONTAINER`         | `uploads`        | Blob container name.                                               |
| `AZURE_STORAGE_ACCESS_TIER`       | `Cool`           | `Hot` / `Cool` / `Archive`.                                        |
| `MAX_UPLOAD_MB`                   | `30`             | Multipart cap; mirrored as `VITE_UPLOAD_MAX_MB` on the frontend.   |
| `GM_API_KEY`                      | —                | Long random string. Source of the GM unlock secret.                |
| `CLIENT_SECRET`                   | —                | Shared with the frontend (`VITE_CLIENT_SECRET`).                   |
| `JWT_SECRET`                      | —                | Signs the GM JWTs.                                                 |
| `JWT_EXPIRES_IN`                  | `8h`             | JWT TTL.                                                           |

---

## 6. Architecture: hexagonal layering

The codebase is split between framework-free domain code (`core/`) and adapters (`infra/`). The DI container (`src/di/container.ts`) wires them.

```
                ┌────────────────────────────┐
                │          core/             │
                │                            │
                │   entities (Player, …)     │
                │   repositories (ports)     │
                │   use-cases (Application)  │
                └──────────────▲─────────────┘
                               │ depends-on
                               │
                ┌──────────────┴─────────────┐
                │          infra/            │
                │                            │
                │  Drizzle repositories      │
                │  Fastify routes/controllers│
                │  Storage adapters          │
                └────────────────────────────┘
```

**Rules:**

- `core/` knows nothing about Fastify, Drizzle, Azure, etc. It can be swapped out wholesale.
- A controller never imports a repository directly. It uses a use-case, which the DI container resolves with the right concrete dependency.
- A repository implementation lives in `infra/repositories/` and implements a port from `core/repositories/`.
- New external dependencies (HTTP clients, queues, …) become adapters under `infra/`.

---

## 7. Request lifecycle

1. **Server boot** (`buildServer()`): registers Helmet (strict CSP), CORS, rate-limit, multipart, static (`/files/*`), JWT, the visibility-filter plugin, the swagger plugin, the error-handler, and finally each route module.
2. **Player request → `/api/...`**: Zod validates the body/params/query; the route's controller resolves the use-case from the container; the use-case calls the repo; the response is a plain object.
3. **GM request → `/api/...`**: same as above plus the `auth` plugin, which verifies the JWT (Bearer token issued by the GM unlock endpoint).
4. **Listing/get for non-GM**: the visibility-filter plugin strips hidden entities from the response shape.
5. **Uploads → multipart**: streamed to disk (`local`) or Blob (`azure-blob`); MIME validated against an allow-list with extension fallback for browsers that report `application/octet-stream`.
6. **Errors**: thrown errors propagate to the error-handler plugin, which maps to JSON `{ error, message, statusCode }`. Zod errors return `400` with a `details` array.

---

## 8. Authentication

There's no user system. Two roles only:

- **Player** (anonymous client).
- **GM** (authenticated with a JWT).

The GM login flow (`src/infra/http/plugins/auth.ts`):

1. Frontend sends `POST /api/auth/login` with `{ apiKey: string }`.
2. The brute-force tracker (`src/infra/security/brute-force.ts`) checks the IP. If locked out, the server replies `429` with a `Retry-After` header and the call short-circuits.
3. The server compares `apiKey` against `GM_API_KEY` using `safeCompare()` (constant-time).
4. On failure → `recordFailure(ip)` and `401`.
5. On success → `recordSuccess(ip)`, sign a JWT with `JWT_SECRET` and TTL `JWT_EXPIRES_IN`, return `{ token, expiresAt }`.
6. Frontend stores the JWT and sends it as `Authorization: Bearer <jwt>` for every subsequent request.
7. A global `onRequest` hook decodes the JWT (if present) and sets `req.isGM = true` when `role === 'gm'`.
8. Routes that need GM mode use the `app.withGM(opts)` shorthand (or attach `app.requireGM` as a `preHandler` manually). `requireGM` re-checks the brute-force tracker and returns `401` if `req.isGM` is false.

**Key strength validation** (`validateGMKeyStrength`): on boot, `GM_API_KEY` must be ≥ 24 characters and contain at least 3 character classes (upper / lower / digits / symbols). In `production` a weak key throws and aborts boot. In `development` it logs a warning so the dev experience is not blocked.

**Production hardening**:

- `GM_API_KEY` and `JWT_SECRET` are **required** when `NODE_ENV=production`. Boot fails fast otherwise.
- A weak `GM_API_KEY` aborts boot in production.
- The dev fallback for `JWT_SECRET` (`dev-jwt-secret-change-me-in-production`) is only used outside production — never deploy without setting `JWT_SECRET`.

The shared `CLIENT_SECRET` is verified by `client-auth` on every request — it's a soft sanity check that the request comes from a legitimate Picho-RPG frontend, not a strong auth boundary.

---

## 9. Conventions that matter

### Routes + schemas

- Each route module declares routes plus Zod schemas inline (`schema: { body: z.object({...}) }`).
- The type provider (`fastify-type-provider-zod`) infers `req.body`/`req.query`/`req.params` types automatically.
- Same Zod schema is consumed by `@fastify/swagger` to produce OpenAPI; no separate spec to maintain.

### Controllers

- Pure functions of the form `(req, reply) => ...`.
- They resolve use-cases from the container (`req.diScope.resolve(...)` or container-level helpers).
- Never call Drizzle directly. If a controller needs a query, add a repo method.

### Use-cases

- One class per use-case. Constructor injects the repo (and any other deps).
- A single `execute()` method. Side-effects through the repo only.
- Throw typed errors (`NotFoundError`, `ValidationError`, …) from `core/`.

### Repositories

- Interface in `core/repositories/<entity>.repository.ts`.
- Implementation in `infra/repositories/<entity>.drizzle.repository.ts`.
- Returns plain entities (`new Player(...)` etc.), not Drizzle rows.

### File storage

- Always go through `fileStorage` (the configured driver).
- The public URL is always `/files/<key>` regardless of driver.
- Range support is handled by `parseRangeHeader()` for streaming large files.

### Migrations

- Edit `src/infra/db/schema.ts`.
- Run `npm run drizzle:generate` to produce the next `0xxx_*.sql`.
- Inspect the SQL — Drizzle Kit is usually right but not always for renames/drops.
- Commit and run `npm run drizzle:migrate` locally.

### Testing

- Vitest with a real SQLite DB at `data/test.db`. Tests reset the DB before each run.
- Use `app.inject(...)` from Fastify (`buildServer()`) to drive routes end-to-end.
- Don't depend on hardcoded ids — chain creates → uses.

---

## 10. Library upload pipeline (the trickiest area)

`POST /api/library/upload` (GM-only) accepts a multipart `file`:

1. `mimetype` is taken from the multipart part. If not in `ALLOWED_MIME`, fall back to extension-based detection (some browsers send `application/octet-stream` for `.mobi`, `.epub`, `.csv`, etc.).
2. If still not allowed, reject with `400`.
3. Stream into a temporary location, then move into final storage.
4. **MOBI special case**: try `ebook-convert` (Calibre) to convert into EPUB. On success, the stored mime becomes `application/epub+zip` and the original `.mobi` is removed. On failure, store the `.mobi` as-is — frontend falls back to download.
5. Persist the `LibraryDocument` row.

Allowed MIME map and the EXT-to-MIME fallback live in [`src/infra/http/controllers/library.controller.ts`](src/infra/http/controllers/library.controller.ts). Keep this list in sync with the frontend's `VIEWABLE_MIME` and `ACCEPTED` constants.

CSV is supported (`text/csv` and `application/csv` → `.csv`).

---

## 11. Storage adapters

The `FileStoragePort` interface (`src/infra/storage/file-storage.port.ts`) defines:

- `save(key, stream/Buffer, { mime })` → persist
- `read(key, { range? })` → stream + metadata
- `delete(key)` → remove
- `exists(key)` → boolean

Two implementations:

- **`LocalFileStorage`** writes to `UPLOADS_LOCAL_DIR`. The serving comes from `@fastify/static` mounted at `/files/*`.
- **`AzureBlobFileStorage`** uses `BlockBlobClient`. The route `/files/<key>` reads-through from Blob.

The adapter is chosen at server boot in `src/infra/storage/index.ts`.

To migrate existing local uploads to Blob:

```bash
npm run storage:migrate:azure-blob
```

---

## 12. Security defaults

- **Helmet**: strict CSP (`default-src 'none'`, no script-src, no styles), cross-origin CORP, COOP `same-origin`, hidden `X-Powered-By`.
- **CORS**: allow-list driven by `CORS_ORIGIN` (comma-separated).
- **Rate limiting**: `@fastify/rate-limit` with permissive defaults; tighten via env if exposed publicly.
- **Body size**: 512 KB cap on JSON. Multipart uploads have their own cap (`MAX_UPLOAD_MB`).
- **MIME allow-list**: every upload route uses an explicit list, with extension fallback.
- **GM unlock brute-force tracker**: in-memory per-IP backoff. State is process-local — if you scale to multiple replicas, swap the implementation for a shared store.
- **JWT**: short-lived (`JWT_EXPIRES_IN`), signed with `JWT_SECRET`. Rotate by changing the env var (kicks all sessions out).
- **`safeCompare`**: constant-time compare for secrets.

If you add a new endpoint that reads/writes user-controlled data, check:

1. Is the body schema-validated with Zod?
2. Does the response leak hidden data when the caller is non-GM? If yes, register the route under the visibility-filter plugin or add the filtering inside the use-case.
3. Are file paths/keys validated to prevent traversal? `decodeStorageKey()` is the canonical helper.

---

## 13. Common patterns

### Adding a new endpoint to an existing entity

1. Add the use-case under `src/core/use-cases/<domain>/`.
2. Extend the repo interface in `src/core/repositories/` if needed.
3. Implement the new repo method in `src/infra/repositories/<entity>.drizzle.repository.ts`.
4. Register the use-case in `src/di/container.ts`.
5. Add the controller method in `src/infra/http/controllers/<domain>.controller.ts`.
6. Declare the route + Zod schema in `src/infra/http/routes/<domain>.routes.ts`.
7. Add a Vitest case under `tests/`.

### Adding a new entity

1. Define the table in `src/infra/db/schema.ts`.
2. `npm run drizzle:generate` then `npm run drizzle:migrate`.
3. Create the entity class in `src/core/entities/`.
4. Create the repo interface + Drizzle implementation.
5. Add the use-cases, controller and routes following the pattern above.
6. Mount the routes in `src/infra/http/server.ts`.

### Adding a new file MIME

1. Update `ALLOWED_MIME` in `library.controller.ts` (and `EXT_TO_MIME` if browsers report it as `octet-stream`).
2. Update the matching list in the **frontend** (`src/api/library.api.ts` `mimeLabel()` and `LibraryPage.tsx` `ACCEPTED`/`VIEWABLE_MIME`).
3. Implement (or extend) the viewer on the frontend.
4. Test upload + view round-trip.

---

## 14. Gotchas (read before debugging)

- **ESM imports need explicit `.js` extensions** when targeting Node ESM. Source code uses `.js` even though files are `.ts` (Drizzle/Vitest tolerate it). The post-build script `scripts/fix-dist-imports.mjs` ensures `dist/` is correct.
- **Drizzle migrations are append-only.** Never edit a published migration. To revert a schema change, write a new migration.
- **better-sqlite3** requires native build tools. CI handles it via the Dockerfile (`python3`, `make`, `g++`). Locally on Windows, install Visual Studio Build Tools.
- **Test DB locking**: tests run sequentially because SQLite locks the file. Don't `vitest --threads`.
- **Visibility-filter plugin** runs after the route handler. If you build a custom response shape, make sure the filter's reflection still works (it walks arrays + objects of known entities).
- **Brute-force tracker** is in-memory. In a multi-replica deploy, the tracker becomes per-replica — easier to bypass via load balancing. Swap for a shared store before scaling out.
- **Calibre is optional but recommended** for `.mobi` uploads. The deploy image already includes a hint to install it; verify with `ebook-convert --version` in the running container.
- **`JWT_SECRET` rotation** invalidates all in-flight GM sessions. Document this for ops.
- **Zod 4** changed `z.record()` to require both keys and values. We pin Zod 3 in the manifest, but if it's ever bumped, watch for that breaking change.
- **CORS in dev**: when running the front-end on `http://localhost:3000` and the API on `http://localhost:3010`, set `CORS_ORIGIN=http://localhost:3000` (not `*`) once you start sending credentials.

---

## 15. Don'ts

- Don't import Drizzle directly from a controller or use-case.
- Don't put framework code (Fastify, Drizzle) in `src/core/`.
- Don't add a route that bypasses the visibility filter without a documented reason.
- Don't read `process.env` outside `src/infra/config/env.ts`.
- Don't write tests that rely on a specific id; chain creates → uses.
- Don't store secrets in repository code, in tests or in commit history. Rotate `JWT_SECRET` and `GM_API_KEY` if exposed.
- Don't edit existing migration files.
- Don't trust the multipart `mimetype` blindly — extension fallback already exists and should be kept.

---

## 16. Useful pointers

| Need…                              | Look at                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Adding an upload type              | [src/infra/http/controllers/library.controller.ts](src/infra/http/controllers/library.controller.ts)         |
| Hexagonal wiring                   | [src/di/container.ts](src/di/container.ts)                                                                   |
| Storage interface + adapters       | [src/infra/storage/](src/infra/storage/)                                                                     |
| GM auth + brute-force tracker      | [src/infra/security/](src/infra/security/), [src/infra/http/plugins/auth.ts](src/infra/http/plugins/auth.ts) |
| Schema (all tables)                | [src/infra/db/schema.ts](src/infra/db/schema.ts)                                                             |
| Drizzle migrations                 | [drizzle/migrations/](drizzle/migrations/)                                                                   |
| Server bootstrap (plugins, mounts) | [src/infra/http/server.ts](src/infra/http/server.ts)                                                         |
| Error → JSON mapper                | [src/infra/http/plugins/error-handler.ts](src/infra/http/plugins/error-handler.ts)                           |
| OpenAPI spec / Swagger UI          | [src/infra/http/plugins/swagger.ts](src/infra/http/plugins/swagger.ts) → `/docs`                             |
| Tests setup                        | [tests/setup.ts](tests/setup.ts)                                                                             |
| Dockerfile                         | [Dockerfile](Dockerfile)                                                                                     |
| Azure deploy manifests             | [deploy/azure/](deploy/azure/)                                                                               |

---

## 17. Roadmap context

Recent moves (already completed):

- Migrated to Fastify 5 + Zod type provider.
- Adopted Drizzle + SQLite (replacing earlier prototype with raw SQL).
- Hexagonal split between `core/` and `infra/`.
- Pluggable storage (local + Azure Blob) behind a port.
- Library upload pipeline with MIME allow-list + Calibre MOBI conversion.
- Helmet hardening + JWT-based GM mode.
- Vitest with a dedicated test DB.

If you're touching a controller that still mixes business logic and HTTP concerns, that's tech debt — extracting it into a proper use-case is welcome.

---

## 18. Contact

- GitHub: <https://github.com/picho-org/picho-rpg-backend>
- General: `contact@picho.org`
- Security: `security@picho.org` (see [SECURITY.md](SECURITY.md))
- Code of conduct issues: `conduct@picho.org`
