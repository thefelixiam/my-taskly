# AGENTS.md

## Test automation
- `.opencode/agents/test-writer.md` is a custom OpenCode agent that writes/updates unit tests for PR diffs (PR mode) or for coverage-audit targets (`AGENT_MODE=improve`); its knowledge lives in the skills under `.opencode/skills/` (analyze-changes, backend-testing, frontend-testing, verify-tests). `SOLUTION.md` documents the whole setup; `.github/workflows/pr-test-agent.yml` runs it on PRs, `test-coverage-audit.yml` is the manual audit (with an `improve` option that opens a PR with generated tests).
- `.agent-output/` is agent runtime output (gitignored) — never commit it.

## Layout
- Two independent npm packages with **no root `package.json` or workspaces**. Run every command inside `backend/` or `frontend/` (use the workdir option, not `cd`).
- `backend/` = Express + Prisma API. `frontend/` = React + Vite SPA (nginx in Docker).
- `backend/openapi.json` is committed and served at `/docs` and `/openapi.json`. Update it when routes/schemas change.

## Backend (`backend/`)
- Node >=22.12, ESM. Source files import siblings with explicit **`.js`** extensions (NodeNext); **tests import with `.ts`** extensions (`allowImportingTsExtensions`). Match the file you touch.
- Prisma client is generated into `src/generated/prisma/` (gitignored). On a fresh clone run `npm run db:generate` before typecheck/tests; it also runs on `postinstall` and `prebuild`.
- **No Prisma migrations.** The `todos` table is created by raw SQL in `src/core/database.ts` `initialize()`. Schema changes must be made in BOTH `prisma/schema.prisma` and that SQL.
- Config loads the **root** `.env` (resolved to `../../../.env` from `src/core/config.ts`). Copy `.env.example` -> `.env`; provide `DATABASE_URL` or all of `POSTGRES_USER/PASSWORD/HOST/DB_PORT/DB`.
- Tests need **no running database**: they construct a real `PrismaClient` via `createDatabase('postgresql://...')` and `vi.spyOn` the `database.todo` delegate. Tests live in `backend/tests/`, not beside source.
- Vitest globals are off; import `{ describe, it, expect, vi }` from `vitest`.
- Coverage requires `src/features/todos/validators.ts` and `mappers.ts` at 100% per-file.
- Commands: `npm run typecheck`, `npm test`, `npm run test:watch`, `npm run test:coverage`, `npm run dev`, `npm run build && npm start`.

## Frontend (`frontend/`)
- Prettier only (no ESLint): `npm run format` / `format:check`. Style is no semicolons, single quotes, trailing commas. Backend uses semicolons and has no formatter.
- Tests are co-located `*.test.tsx`. Vitest globals are off; import from `vitest`.
- Component tests mock the design system: `vi.mock('../../../design-system', () => import('../../../design-system/mocks'))` — the factory is async because `vi.mock` is hoisted.
- `src/design-system/**` is excluded from coverage and covered by Storybook instead. Stories glob only matches `src/design-system/**/*.stories.tsx`.
- Shared fixtures in `src/test/todoFixture.ts`; setup in `src/test/setup.ts` (jsdom + jest-dom, cleanup per test).
- API base is `/api` (dev Vite proxy -> `127.0.0.1:8000`; prod nginx -> `backend:8000`).
- Commands: `npm run typecheck`, `npm test`, `npm run test:watch`, `npm run test:coverage`, `npm run dev`, `npm run storybook`, `npm run build`.

## Full stack
- Copy `.env.example` to `.env` first, then `docker compose up --build -d --wait`. Web :8080, API :8000/docs.
- The Postgres volume name is intentionally pinned to the old project name (`taskly-app-main_postgres-data`) so data survives renames — do not "fix" it.

## Order
- No lint step exists. Typical check: `npm run typecheck` then `npm test`. Frontend `build` itself runs `tsc --noEmit && vite build`.
