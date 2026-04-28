# Contributing to Picho-RPG · Back-end

Thanks for your interest. Picho-RPG is built and maintained openly under the [picho.org](https://picho.org) umbrella, and contributions of any size are welcome.

This guide describes how to set up the project, the workflow we use for changes, and what makes a good PR. Please also read the [Code of Conduct](CODE_OF_CONDUCT.md).

> Looking for a deeper technical orientation? See [`AGENTS.md`](AGENTS.md) for an exhaustive map of conventions, layering, and gotchas.

---

## Ways to contribute

| Contribution        | Where to start                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Bug report          | [Open an issue](https://github.com/picho-org/picho-rpg-backend/issues/new) describing the problem and reproduction. |
| Feature suggestion  | Open an issue first to align scope before coding.                                                                   |
| Documentation fix   | Direct PR — small docs PRs ship fast.                                                                               |
| New endpoint        | Open an issue first; ensure it fits the hexagonal layering (see AGENTS.md).                                         |
| New entity / domain | Always open an issue first; this affects schema and migrations.                                                     |
| Security report     | **Do not open a public issue.** See [`SECURITY.md`](SECURITY.md).                                                   |

---

## Getting set up

```bash
cp .env.example .env       # adjust GM_API_KEY, JWT_SECRET, CLIENT_SECRET, etc.
npm install
npm run drizzle:migrate    # creates data/app.db and applies all migrations
npm run dev                # http://localhost:3010 (Swagger UI at /docs)
```

The frontend ([`picho-rpg-front`](https://github.com/picho-org/picho-rpg-front)) typically runs on port `3000` and points its `VITE_API_BASE_URL` at this server.

For tests, vitest writes to a separate DB (`data/test.db`) so it's safe to run against your dev environment:

```bash
npm test                   # watch mode
npm run test:run           # single run
npm run test:cov           # with V8 coverage
```

---

## Branch and PR workflow

1. **Fork** (or create a feature branch on the upstream remote if you have access).
2. Branch from `main` using a [conventional](https://www.conventionalcommits.org/en/v1.0.0/) prefix:
   - `feat/...` for new endpoints/features
   - `fix/...` for bug fixes
   - `chore/...` for tooling, deps, refactors
   - `docs/...` for documentation
3. Keep commits small and focused.
4. Open the PR against `main`. Use the PR template — explain the _why_, list changes, link the related issue.
5. Make sure the PR is green:
   - `npm run lint`
   - `npm run build`
   - `npm run test:run`
   - (Or just `npm run check` which runs all three.)

We squash-merge by default. The PR title becomes the commit message on `main`.

---

## Code style

- **TypeScript first.** Prefer explicit types at module boundaries; let inference handle the rest. Avoid `any`; if forced, use `unknown` and narrow.
- **ESM modules.** The package is `type: module`. Imports between source files use the `.js` extension after build (handled by `scripts/fix-dist-imports.mjs`).
- **Hexagonal layering.** `core/` is framework-free (entities + use-cases + repository ports). `infra/` is the only place that knows about Fastify, Drizzle or Azure.
- **Zod schemas live in `routes/`** alongside the route declaration. Don't validate inside controllers.
- **One handler per file** in `controllers/`; one route file per domain in `routes/`.
- **Repositories** in `src/infra/repositories/` implement the interfaces declared under `src/core/repositories/`.
- **DI** is wired manually in `src/di/container.ts`. Don't import a repository directly from a controller — go through the container.
- **Format** with Prettier (`npm run format`) and lint with ESLint (`npm run lint`).

### Adding a new endpoint to an existing entity

1. Add the use-case to `src/core/use-cases/<domain>/`.
2. If you need a new repo method, add it to the interface in `src/core/repositories/` and to the Drizzle implementation in `src/infra/repositories/`.
3. Register the use-case in `src/di/container.ts`.
4. Add the controller method in `src/infra/http/controllers/<domain>.controller.ts`.
5. Declare the route + Zod schema in `src/infra/http/routes/<domain>.routes.ts`.
6. Mount the route in `src/infra/http/server.ts` (already wired for existing domains).
7. Add a Vitest case under `tests/`.

### Adding a new entity

1. Define the table in `src/infra/db/schema.ts`.
2. Run `npm run drizzle:generate` to produce the migration SQL.
3. Run `npm run drizzle:migrate` locally.
4. Create the entity class in `src/core/entities/`.
5. Create the repo interface in `src/core/repositories/` and the Drizzle impl in `src/infra/repositories/`.
6. Add the use-cases, controller and routes following the pattern above.

---

## Testing

We use **Vitest** with a real SQLite test DB (`data/test.db`) — no mocking of Drizzle. Tests run sequentially because SQLite locks the file. Conventions:

- Reset the test DB before each test (`tests/setup.ts`).
- Build the Fastify app with `buildServer()` and inject requests via `app.inject(...)`.
- Don't depend on a specific id — use the response of the previous create.

Before opening a PR, please:

- Add or update tests for the change.
- Make sure `npm run check` passes locally.

If you can't write a test for a tricky integration (e.g. Azure Blob), explain in the PR description what you verified manually.

---

## Migrations

Migrations are SQL files committed under `drizzle/migrations/`. They are **append-only**; never edit a published migration.

```bash
# After editing src/infra/db/schema.ts
npm run drizzle:generate    # creates the next 0xxx_*.sql file
npm run drizzle:migrate     # applies it locally
```

Inspect the generated SQL before committing — Drizzle Kit is good but not perfect, especially with renames/drops.

---

## Working on Windows

- The default `better-sqlite3` install requires native build tools (Visual Studio Build Tools or `windows-build-tools` on older setups). The Dockerfile installs them on Linux automatically.
- Long path support: `git config --system core.longpaths true`.
- Calibre's `ebook-convert` must be on `PATH` for the Library MOBI conversion path to work locally.

---

## Release notes

Versions live in `package.json`. We don't publish to npm — releases are deploy-driven via the Container Apps pipeline.

If your PR introduces user-visible behaviour or is a breaking change, mention it under "Notes" in the PR description so the maintainer can copy it to the release annotation.

---

## Getting help

- General questions or roadmap: open a GitHub Discussion.
- Help with a stuck PR: ping the maintainer in the PR — friendly nudge welcome after 48h.
- Anything off-topic: `contact@picho.org`.
