---
name: backend-testing
description: Conventions and commands for writing and running backend unit tests (backend/, Express + Prisma, Vitest + Supertest, no database required). Use when creating or updating tests under backend/tests/.
---

# Backend testing conventions

All commands run in `backend/`. Node >= 22.12 is required (tests use `createDatabase` with a fake URL; no PostgreSQL is needed).

## Where tests live

- `backend/tests/<name>.test.ts` — flat, matched to the source file base name (`src/features/todos/mappers.ts` → `tests/mappers.test.ts`).
- Shared fixtures in `backend/tests/fixture.ts` (`record`, `todo`).

## Style — must follow

- **Tests import with `.ts` extensions**: `import { TodoRepository } from '../src/features/todos/repository.ts'` (tsconfig `allowImportingTsExtensions`; production code keeps `.js` — never "fix" source imports).
- **Semicolons and single quotes** — backend has no formatter; match the existing test files.
- Vitest **globals are off**: `import { describe, it, expect, vi, afterEach } from 'vitest'`.
- No `describe` wrappers are required — existing tests use plain `it`/`it.each`.
- Bash is permission-limited: run package commands with the bash tool's **working-directory option** set to `backend/` — `cd backend && <cmd>` chains are denied.

## Patterns to copy (read these first)

- Repository tests (`tests/repository.test.ts`): build a real Prisma client via `createDatabase('postgresql://test:test@localhost:5432/test')`, then `vi.spyOn(database.todo, '<method>')` — mock the delegate IO, never the PrismaClient class. `afterEach(() => vi.restoreAllMocks())`.
- Router tests (`tests/router.test.ts`): mount `createTodosRouter(repository)` on a fresh `express()` app with `express.json()` at `/api/todos`, stub the repository with `vi.fn()`s, and drive it with `supertest` (`request(app).get('/api/todos')`). Assert status codes, body, and that validation failures (422) do not reach the repository.
- Validators/mappers: pure functions, `it.each` for invalid inputs.
- `src/core/database.ts`, `lifespan.ts`, `factory.ts`, `api/health.ts` currently have no dedicated tests — if the diff touches them, test them the same way (spy on the `database.todo` delegate / inject a fake `Database`).

## Coverage gate

`npm run test:coverage` enforces **100% per-file** on `src/features/todos/validators.ts` and `src/features/todos/mappers.ts`. If your change (or the PR you are testing) touches those files, the added tests must keep them at 100%: every branch, both sides of each ternary/`??`/short-circuit.

## Commands

```sh
npm run typecheck                          # tsc --noEmit (needs prisma client generated; npm ci postinstall does it)
npx vitest run tests/mappers.test.ts      # one file
npx vitest run -t "name fragment"         # filtered by test name
npm test                                  # whole suite
npm run test:coverage                     # suite + coverage, enforces thresholds
```

Exit codes matter: verify with `npm test` (not just one file) before reporting success.
