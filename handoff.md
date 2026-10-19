# HANDOFF · Picho-RPG

Context for any AI agent or human continuing the work. Last update: 2026-10-18. The next work is listed in [todo.md](todo.md).

## The project

Picho-RPG (https://rpg.picho.org) is the owner's personal companion app for their Phantasy Star tabletop campaign. They are the GM, and there are at most ~5 users. Keep solutions simple and cheap: **no paid database**; SQLite + Blob is intentional.

| Repo  | Path                                  | Stack                                                                 | Azure                                                                                         |
| ----- | ------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Back  | `E:\Projects\phantasy-star-rpg`       | Fastify 5, Zod, Drizzle, better-sqlite3, hexagonal `core/` + `infra/` | Container App `picho-rpg-api`, ACR `pichorpg2404acr`, storage `pichorguploads01`, rg `AZR-BR` |
| Front | `E:\Projects\phantasy-star-rpg.front` | React, Vite, antd + antd-mobile, styled-components, Redux Toolkit     | Static Web App `picho-rpg-web`                                                                |

Each repo has an `AGENTS.md`: read it. This file only adds what is not there.

## Owner's rules (must follow)

- The owner writes in **Portuguese**; answer them in Portuguese. **All site UI and labels are English.** The language of stored data does not matter.
- **Commit only when asked; push and deploy only when explicitly asked.** "Commit without push" is common.
- **Never delete data, blobs or files without asking.**
- The GM key is in the local env var `gmkey`. Never print it or commit it. Never write secrets to GitHub secret stores without approval.
- Present a plan for larger features before implementing them. Once phases are approved, run them back to back.

## Roles and visibility

- Player: anonymous. The GM: JWT obtained with the GM key (brute-force protected).
- Hidden (`visible=false`) and undiscovered content must never leak to players. This covers lists, gets, tags, links, search, counts and file URLs. A full endpoint audit was done; keep new endpoints to the same standard (`visibility-filter` plugin, or filtering in the use-case).

## Key building blocks already in place

**Back**

- Backups: `src/infra/backup/`. Periodic SQLite snapshots to the private Blob container `db-backups`, plus `GET /api/gm/database/download` and `POST /api/gm/database/backup`.
- Thumbnails: `src/infra/storage/image-thumbnails.ts` (sharp). `/files/<key>?w=320|640|1280`, cached under `_thumbs/`.
- Image focal points: table `image_focus`, created at boot because **production does not run migrations**; routes in `image-focus.routes.ts`.
- Known debt: the test-DB migrations are incomplete and `tests/player.routes.test.ts` is outdated (todo 0.1).

**Front**

- `components/common/EntityDrawer`: the single declarative drawer (overview, tabs, controls, gmTabs with `mobileChildren`). It renders a `MobileEntitySheet` on phones. All domains use it.
- `components/common/EntityCard` + `EntityCardGrid`: the card pattern from Sessions. Cards are shape-aware and use container queries for narrow cards.
- `ContainedImage` shows images without distortion, with transparent bands (the parent background shows through). `RichText` renders Markdown everywhere.
- Themes live in `src/styles/themes/` (contract, foundation, registry, `motavia/`, `dezolis/`). Each world is fully isolated (`[data-theme='<id>']`, no colors in `:root`). The theme modes are manual, follow the system, and schedule. CI runs `scripts/check-theme-isolation.mjs` and `scripts/check-theme-contrast.mjs` with `--strict`. Planned future theme: Rykros. No Palma theme: it was destroyed in the lore.
- Character sheets:
  - GURPS imports from GCA (`src/utils/gca-import.ts`).
  - Starfinder imports Hephaistos PDFs (`src/utils/hephaistos-import.ts`, reading the AcroForm fields with pdfjs). The rules live in `src/utils/starfinder-calc.ts`: the class skill +3 needs at least 1 rank, and Profession can use Cha, Int or Wis.
  - Validated on Rook, Linus Mendel, Kiran and Bobbin Coop'pot. Alys Brangwin was a test sheet: ignore it.
- `src/config/pdf.ts` holds the pdfjs worker and font URLs.

## Content

- The Motavia economy markdowns were imported into the wiki in an "Economia" category; reserved pages are hidden. They are useful for the shop generator (todo 4.2).
- NPCs from Piata were exported to `C:\Users\jonat\OneDrive\Importante\RPG\Npcs\Piata`.

## Running locally with production-like data

API: `PORT=3010 DATABASE_URL=<copy of prod db> FILE_STORAGE_DRIVER=local UPLOADS_LOCAL_DIR=<dir> CORS_ORIGIN=http://localhost:3000 BACKUP_ENABLED=false GM_API_KEY="$gmkey" CLIENT_SECRET=... JWT_SECRET=<any long local value> npx tsx src/app.ts`

Front: `VITE_API_BASE_URL=http://localhost:3010 VITE_CLIENT_SECRET=... npx vite --port 3000`

Use a copy of the DB, never the production file.

## Windows gotchas seen

- Python writes CRLF unless you open files with `newline=''`.
- Watch out for escaping in bash heredocs: prefer writing script files.
- The front's lint-staged pre-commit hook runs ESLint. Run `npx tsc --noEmit`, `npx eslint src`, `npx vite build` and both theme checks before committing.

## State at handoff

- Foundations (todo 0.x) and the combat tracker (1.1) are done.
- The error handler is now global (fastify-plugin, registered before the routes). Before that it never ran, so every Zod error became a 500. Responses keep Fastify's `{ statusCode, error, message }` shape.
- Release with `npm run release` (both repos) after committing; `-- --dry-run` checks only.
- Next step: [todo.md](todo.md) section 2 (living wiki), unless the owner says otherwise.
