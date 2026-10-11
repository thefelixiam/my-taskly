---
name: frontend-testing
description: Conventions and commands for writing and running frontend unit tests (frontend/, React 19 + Vitest + React Testing Library + jsdom). Use when creating or updating *.test.tsx files.
---

# Frontend testing conventions

All commands run in `frontend/`.

## Where tests live

- Co-located: `frontend/src/<path>/<name>.test.tsx` next to the source file (`TodoItem.tsx` → `TodoItem.test.tsx`).
- Shared fixture: `src/test/todoFixture.ts` (a ready `Todo` object) — prefer it over hand-made data.
- `src/design-system/**` is tested by Storybook stories, not unit tests — do not add unit tests there.
- Setup (`src/test/setup.ts`) already registers jest-dom and cleanup; do not import setup files in tests.

## Style — must follow

- **No semicolons, single quotes, trailing commas** (Prettier — `.prettierrc.json`).
- Bash is permission-limited: run package commands with the bash tool's **working-directory option** set to `frontend/` — `cd frontend && <cmd>` chains are denied.
- Vitest **globals are off**: `import { describe, it, expect, vi } from 'vitest'`.
- Prefer RTL queries by role/label (`screen.getByRole('button', { name: 'Edit: <title>' })`); interactive checks with `userEvent.setup()`.
- Component tests that import the design system **must** mock it (styling in jsdom is slow and noisy):
  `vi.mock('../../../design-system', () => import('../../../design-system/mocks'))` — factory is async because `vi.mock` hoists. Adjust the relative path to the file under test.
- Hooks tests: render a tiny harness component; for data hooks (`useTodosQuery`, mutations) mock the API layer module (`vi.mock('<feature>/api/todos', ...)` or `vi.mock` on the query functions) rather than networking.
- `src/lib/http.ts` `request()` is the only network path — tests for API modules mock `fetch` (global) or the `request` module, never hit the network. See `src/features/todos/api/todos.test.ts` for the pattern.
- The API base is `/api` (`src/lib/http.ts`).

## Commands

```sh
npm run typecheck
npx vitest run src/features/todos/components/TodoItem.test.tsx   # one file
npx vitest run -t "name fragment"                                 # filtered
npm test
npm run test:coverage
npm run format:check    # Prettier check — run after adding files
npm run format          # auto-fix formatting if format:check fails (only acceptable target of format)
```

New test files must pass `format:check`. Note: the repo has pre-existing Prettier warnings in files you did not touch (`index.html`, `src/components/ApplicationHeader.test.tsx`) — ignore those. Verify and format **only your own files**: `npx prettier --check <your-file>` / `npx prettier --write <your-file>`. Never format or report unrelated files.
