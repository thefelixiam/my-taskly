---
name: verify-tests
description: End-to-end verification of the test suites after creating or updating tests — runs typechecks, tests, and coverage for both packages and requires all green. Use last in any test-writing workflow.
---

# Verify tests

Use only when your instructions allow executing tests. The CI workflows explicitly delegate verification to an independent verify job ("do not run tests") — in that case skip this skill, run only the non-test checks (typecheck, Prettier), and report that test verification is deferred to CI.

Non-negotiable gate before reporting success. Run each command from its package directory (`backend/`, `frontend/`), record the exact command and result for the report. If a check fails, fix your tests (never the production code, never the thresholds/configs) and re-run. Do not report success until every applicable check passed in this session.

## Backend (`backend/`)

```sh
npm run typecheck        # needs generated Prisma client (npm ci / npm run db:generate)
npx vitest run <file>    # fast feedback loop while iterating
npm test                 # full suite
npm run test:coverage    # full suite + 100% per-file gate on validators.ts and mappers.ts
```

Only the files you touched can justify skipping a check (e.g. no backend changes → skip backend suite, and say so in the report).

## Frontend (`frontend/`)

```sh
npm run typecheck
npx vitest run <file>
npm test
npm run test:coverage
npm run format:check     # Prettier must accept every file you created/modified
```

## Rules

- Run the **full suites** (`npm test`), not only your files — the point is proving no regressions.
- **Fix attempts are limited: at most 3 fix-and-rerun cycles per failing check.** If a check still fails after 3 attempts, stop iterating: restore a modified existing test file to its previous state (or leave your new test file in place) and report the failure honestly — command, exit code, and the error excerpt. Do not delete or weaken a failing test to manufacture a pass.
- `npm run test:coverage` may fail on pre-existing threshold gaps unrelated to your change (e.g. uncovered files elsewhere). If so: your changed/added test files must still pass and the delta must be explained in the report; never lower thresholds.
- Check `git status --porcelain` at the end: only intended test files (+ `.agent-output/report.md`) should appear. Your write permissions already exclude everything else; if something unexpected still shows up, **report it — do not try to revert it yourself** (`git checkout`/`rm` are not permitted; the workflow discards non-test changes anyway).
- Use the bash tool's working-directory option for package commands — `cd <pkg> && <cmd>` chains are denied by permissions.
- Report real evidence: command, exit code, one-line outcome. If a command could not run, say why. Never report a check as passing unless you saw it pass in its final state — the workflow re-runs every suite independently; a failure there fails the whole run and nothing gets pushed.
