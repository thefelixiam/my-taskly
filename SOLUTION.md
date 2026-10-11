# Solution — Unit Test Agent & Agentic PR Workflow

Custom agent + reusable skills running on **OpenCode**, automated with **GitHub Actions**, for the
Taskly full-stack app (Express + Prisma backend, React + Vite frontend).

## What was built

| Piece                                         | Location                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Custom agent (`test-writer`)                  | `.opencode/agents/test-writer.md`                                                                                        |
| Skill: change analysis (PR mode)              | `.opencode/skills/analyze-changes/SKILL.md`                                                                              |
| Skill: backend testing conventions            | `.opencode/skills/backend-testing/SKILL.md`                                                                              |
| Skill: frontend testing conventions           | `.opencode/skills/frontend-testing/SKILL.md`                                                                             |
| Skill: verification gate (when tests may run) | `.opencode/skills/verify-tests/SKILL.md`                                                                                 |
| Automatic PR workflow                         | `.github/workflows/pr-test-agent.yml`                                                                                    |
| Manual audit workflow (+ improve mode)        | `.github/workflows/test-coverage-audit.yml`                                                                              |
| Helper scripts (zero deps, Node)              | `scripts/coverage-summary.mjs`, `scripts/untested-files.mjs`, `scripts/pr-comment.mjs`, `scripts/write-agent-config.mjs` |
| OpenCode project config                       | `opencode.json` (free Zen model as repo default, session sharing disabled)                                               |

The agent operates in two modes:

- **PR mode** (default) — analyzes the pull request diff and writes/updates tests for changed code.
- **Improve mode** (`AGENT_MODE=improve`) — fills the gaps found by the coverage audit (files with
  no test file or <60% line coverage). This is the executable path for the assignment's "add
  missing unit tests and improve coverage in the existing application" requirement: `improve: true`
  turns the audit into actual, verified test additions proposed as a PR for human review.

In CI the agent is explicitly **not allowed to run test suites** — an independent verify job is the
single test authority. The agent only analyzes, writes tests, runs the cheap non-test checks
(typecheck, Prettier), and reports.

## Main technical decisions and rationale

0. **Default model: a free, curated coding model from OpenCode Zen — `opencode/muse-spark-1.3-contributor-free`.**
   Zen is OpenCode's curated gateway ("models … tested and verified to work well with OpenCode"), and its
   pricing page lists free models explicitly. The choice was verified, not guessed:
   - `opencode models opencode` on the installed version (1.19.0) lists 11 free Zen models — the chosen one
     among them; a live `opencode run` smoke test against it returned successfully.
   - Registry metadata (models.dev, the source opencode uses) confirms for this model: **tool calls ✅,
     reasoning ✅, ~1M context** — the hard requirements for an agent that must call bash/edit/skill tools.
   - It is the free "contributor" variant of the Muse Spark 1.3 family, whose paid sibling sits on the same
     curated Zen list — i.e. the family is verified as a coding agent, and the free variant is aimed at
     open-source contributions (exactly this use case).
   - **Override:** set the repository variable `OPENCODE_MODEL` (format `provider/model`) — the CI passes it
     as `-m`, which takes precedence over the agent's frontmatter `model:` (precedence verified on 1.19.0).
   - `opencode.json` sets the same model as the repo-local default, which also applies to _interactive_
     sessions in this repo (your own sessions can still pick another model per session, or remove the
     `model` key to keep your global default).
1. **OpenCode as the agent runtime, driven headlessly in CI.** OpenCode natively supports
   project-scoped agents (`.opencode/agents/*.md`), skills (`.opencode/skills/<name>/SKILL.md`
   loaded on demand via the `skill` tool), per-tool permission configuration in agent frontmatter,
   and a non-interactive CLI (`opencode run --agent test-writer -m <provider/model>`). All agent
   definitions are versioned in the repo and reviewable in PRs.
2. **Four jobs, strict separation of duties** (`pr-test-agent.yml`):
   - **generate** (fork/default-branch/actor-guarded; `contents: read` only) runs the agent, which
     stages only test-path files and produces a **git patch artifact** plus a report artifact.
   - **verify** (`contents: read`) downloads the patch, re-validates its paths, applies it onto a
     fresh checkout of the PR head, and runs the **full deterministic suites** (backend and
     frontend typecheck + `npm test`). It never trusts the agent's claims.
   - **publish** (`contents: write` + `pull-requests: write`) is the _only_ job that can write:
     it re-validates the already-verified patch, applies it, pushes the test commit to the PR
     branch, and posts/updates the report comment.
   - **report** (`pull-requests: write`) runs exactly when publish was skipped: no patch was
     generated, verification failed, or the agent errored. It publishes the agent's report (or a
     fallback with a logs link) with an explicit status footer — so every agent run leaves a
     result in the PR context, and a failed verification can never read as success.
     The agent itself has **bounded execution**: a hard cap of 200 tool iterations (`steps`), and —
     when it is the one running tests (local runs) — at most 3 fix-and-rerun cycles per failing
     check, after which it must report the failure honestly.
3. **Skills as the knowledge base.** All repo-specific conventions (import styles, test locations,
   mocking patterns, coverage thresholds, formatters, single-test commands, workdir-vs-`cd`)
   live in four skills the agent loads on demand. They are reusable by any other agent or a human
   running OpenCode locally. `verify-tests` applies only when test execution is permitted — in CI
   the workflows delegate verification to the independent job.
4. **Least privilege — enforced at runtime, not just by prompt.**
   - The agent's frontmatter **hard-restricts its tools**: file writes are limited to test paths
     (`backend/tests/*`, `frontend/src/**/*.test.{ts,tsx}`, `frontend/src/test/*`, `.agent-output/*`)
     with a deny-everything default; bash is deny-by-default with a read-only/test-runner
     allowlist; `webfetch`, `websearch`, subagents, `question`, and access outside the worktree
     are denied. Probed empirically: chaining a disallowed command behind an allowed one and
     editing `backend/src/main.ts` are both rejected at the tool-permission level.
   - **Workflow permissions are scoped per job** — generate/verify hold only `contents: read`;
     only publish holds `contents: write` + `pull-requests: write`.
   - The PR is checked out with `persist-credentials: false` in every job — no `GITHUB_TOKEN`
     exists in `.git/config` while the agent runs. The push attaches the token as an
     `http.extraheader` (`base64 -w0`, so it never lands in URLs or logs).
   - The **LLM API key never enters the agent's environment**: a preparation step writes it into
     an OpenCode config file at `$RUNNER_TEMP` (outside the worktree, mode 0600) from GitHub
     Actions Secrets; the agent step receives only `OPENCODE_CONFIG=<path>`. Live-verified: a fake
     key injected this way reaches the Zen gateway and is rejected with `Invalid API key`, proving
     the file-provided key is the one actually used.
   - The patch is path-validated at **every hop** (generation, verify, publish) — anything outside
     test paths is rejected before it can move through the pipeline.
5. **Verified state == pushed state, by construction.** What verify applies and tests is the exact
   patch artifact that publish later applies and pushes — there is no window where a different
   worktree state can diverge from what was verified.
6. **Idempotent PR reporting.** `scripts/pr-comment.mjs` creates or **updates** a single marked
   comment per PR (same marker for publish and report jobs), so repeated runs don't spam. The
   agent itself never touches the GitHub API.
7. **Loop prevention (two layers).** The generate job skips runs whose `github.actor` is
   `github-actions[bot]` — pushes made with `GITHUB_TOKEN` (like this workflow's own test
   commits) never re-trigger the agent. Additionally, events created by `GITHUB_TOKEN` (like the
   improve-mode PR) do not trigger new `pull_request` workflow runs at all — GitHub's built-in
   anti-recursion for token-authored events.
8. **Fork PRs are skipped, explicitly.** `pull_request` runs from forks get no repository secrets
   and a read-only token, so the agent cannot run there (job-level condition; see _Limitations_).
9. **PR content is data, not instructions.** The PR title/body reach the agent as a clearly-labeled
   data file (`.agent-output/pr-context.md`) and via env variables — never interpolated into the
   prompt — and the agent is instructed to ignore any commands found there and report them.

The audit workflow (`test-coverage-audit.yml`) follows the same pattern: the **audit** job runs
typecheck + suites + coverage in both packages independently (`continue-on-error` + a final
"fail if any check failed" step — the full report is produced even when checks fail, and the job
is still red), and the **improve** path is a generate→verify→publish pipeline ending in `gh pr
create` — nothing is ever pushed to the default branch; a human merges it. When the improve agent
generates no changes, its report is surfaced in the job summary instead.

## How to run the workflows — prerequisites

One-time setup (repository **Settings → Secrets and variables → Actions**):

1. Add the **`OPENCODE_API_KEY`** repository secret — a key from OpenCode Zen
   (sign in at **opencode.ai/auth**, create the API key). The default model is a **free** Zen model, so
   agent runs cost nothing beyond Actions minutes.
   Alternatives (only if you override the model): `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or
   `OPENROUTER_API_KEY` — the provider prefix of `OPENCODE_MODEL` selects which secret is required, and
   any other provider fails fast with an explicit error listing the supported set.
2. _(Optional)_ Set repository variable `OPENCODE_MODEL` (format `provider/model-id`) to override the
   default `opencode/muse-spark-1.3-contributor-free`.
3. `GITHUB_TOKEN` needs nothing extra — permissions are declared per job in the workflow files.

The API key is read **only** from GitHub Actions Secrets: a preparation step writes it into an
OpenCode config file at `$RUNNER_TEMP` (outside the worktree, mode 0600), and the agent step
receives only `OPENCODE_CONFIG=<path>`. The key never appears in the agent's environment (so not
in its bash), never in workflow logs, and never in the worktree. Providers are not assumed to
share a credential format — `scripts/write-agent-config.mjs` declares a per-provider secret name
and injection method.

Then:

- **Automatic PR tests:** open/synchronize/reopen any PR from a branch **in this repository**.
  `PR Test Agent` runs the generate → verify → publish (or report) pipeline: agent analyzes the diff
  and writes tests → the patch is verified against full suites on a fresh checkout → verified
  tests are pushed to the PR branch → the report comment is posted/updated (by publish on
  success, by the report job otherwise).
- **Manual audit (no LLM needed):** Actions tab → `Test & Coverage Audit` → _Run workflow_.
  Inputs: `pr_number` (also posts the audit as a PR comment), `comment_on_pr`, and `improve`.
- **Improve mode** (`improve: true`): after a successful audit, the test-writer agent writes tests
  for the detected gaps, the suite verifies them, and a PR with the new tests is opened for
  human review.

Local usage (same agent, no CI), on uncommitted changes. The agent's default model is the free
Zen model from its frontmatter, so local runs need OpenCode Zen connected once (`/connect` →
OpenCode Zen), or pass `-m <provider/model>` to use another provider:

```sh
WORKTREE_ONLY=1 PR_NUMBER=local PR_TITLE="my change" \
opencode run --agent test-writer "Execute the PR unit-test workflow. PR context is in .agent-output/pr-context.md and the PR_NUMBER, PR_TITLE, GIT_BASE_SHA and GIT_HEAD_SHA environment variables. Load your skills in order: analyze-changes, then backend-testing and/or frontend-testing for the files that changed, then verify-tests. Write the final report to .agent-output/report.md."
```

## Verification status — what is proven locally vs what still needs a GitHub run

**Proven locally (actually executed, results below):**

| Item                                                                                                  | Evidence                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default free model exists in the installed version                                                    | `opencode models opencode` (v1.19.0) lists `opencode/muse-spark-1.3-contributor-free`; live `opencode run` smoke test against it replied successfully                                                          |
| Config-file key injection works for the Zen provider                                                  | live test: fake `options.apiKey` in an out-of-worktree `OPENCODE_CONFIG` file → Zen gateway rejected it with `Invalid API key` (i.e. the file-provided key is actually used and overrides ambient auth)        |
| `OPENCODE_MODEL` / `-m` can always override the agent's model                                         | live test: agent with frontmatter `model:` + CLI `-m` → the CLI model won (header line)                                                                                                                        |
| Agent definition loads and runs on OpenCode 1.19.0                                                    | smoke test + three full `opencode run --agent test-writer` sessions                                                                                                                                            |
| Skills are discovered and followed by the agent                                                       | flat-name test mapping, fixtures, `it.each`, workdir usage — knowledge that exists only in the skills                                                                                                          |
| Permission enforcement: bash deny-catchall + chaining blocked, edit deny-catchall on production paths | permission probe run: `git status && echo …` → denied; editing `backend/src/main.ts` → denied                                                                                                                  |
| Permission allowlist still lets the agent work                                                        | improve-mode run executed `npm test`/`npx vitest`/`npx prettier` successfully via the workdir option                                                                                                           |
| Agent produces passing tests (PR mode)                                                                | `backend/tests/search.test.ts` (8 tests) for a new `search.ts`; backend 56/56, frontend 18/18                                                                                                                  |
| Agent produces passing tests (improve mode)                                                           | `backend/tests/router.test.ts` +14 tests (44%→100% lines), `frontend/src/lib/http.test.ts` 9 tests (0%→100%); backend 70/70, frontend 27/27, Prettier clean                                                    |
| Deterministic suites, coverage gates, thresholds                                                      | `npm run typecheck`, `npm test`, `npm run test:coverage` re-run after every agent session — all green, validators/mappers 100% gate intact                                                                     |
| Workflow YAML validity (syntax, expressions, shellcheck, permission scopes)                           | `actionlint` clean on both workflow files (including the 4-job PR pipeline and the report job)                                                                                                                 |
| Helper scripts                                                                                        | `write-agent-config.mjs` (default/override/unsupported/missing-key/bad-format paths), `untested-files.mjs` (+`--coverage`), `coverage-summary.mjs` (real data), `pr-comment.mjs` (`--dry-run`, arg validation) |
| Patch pipeline logic (path filters, `git diff --binary`/`git apply --numstat`, artifact handoff)      | reviewed line-by-line; git-level behaviors were **not** executed in a live runner                                                                                                                              |

**NOT yet verified — requires a real GitHub Actions run (do not assume it works):**

- Workflow execution end-to-end on a runner: artifact handoff between jobs, `git apply` of the
  generated patch, and the generate/verify/publish/report job graph.
- Secret flow from repo settings into the out-of-tree OpenCode config with the real key, plus the
  free model's behavior and rate limits on a runner.
- `GITHUB_TOKEN` push via `http.extraheader` and PR comment posting (publish + report jobs) against
  the live API.
- Improve mode: branch creation, `gh pr create`, and the loop-guard behavior (`github.actor ==
github-actions[bot]`) on the workflow's own pushes.

The first PR and the first audit run must be treated as the verification step; check the job
summaries and the resulting comments, and treat any failure as expected-to-debug rather than
surprising.

## Example runs (both real, local reproductions of the CI jobs)

### 1. PR mode — simulated PR adding an untested feature

Simulated PR: new feature file `backend/src/features/todos/search.ts` (pure helper
`matchesSearch(todo, query)`) with **no test file**. Agent run in working-tree mode
(`WORKTREE_ONLY=1`), same agent and skills as the CI step.

**Agent decisions:** classified the diff (only `search.ts` was test-relevant; workflows/docs
correctly ignored); mapped it to the expected `backend/tests/search.test.ts` (flat-name
convention from the `analyze-changes` skill); decided new tests were required; skipped frontend
work (no frontend changes).

**Skills used:** `analyze-changes` → `backend-testing` → `verify-tests`.

**Result:** `backend/tests/search.test.ts` (8 cases: blank-query short-circuit, trim +
case-insensitivity, description fallback, no cross-field match, empty-description edge case),
matching repo style. Verification (agent-run, then re-run independently): backend typecheck PASS,
suite 56/56, coverage gate PASS with `search.ts` at 100%; frontend 18/18 (regression check).
_(In CI the suites are run by the dedicated verify job instead of the agent — the local run
performed them itself, which is the behavior the `verify-tests` skill prescribes when the
invocation allows running tests.)_

### 2. Improve mode — filling gaps in the _existing_ application

Targets file (as the audit workflow generates): `router.ts` (had tests, 44% lines) and
`http.ts` (no test file, 0%). Agent run with `AGENT_MODE=improve`.

**Agent decisions:** re-measured the baseline itself; extended the existing
`backend/tests/router.test.ts` (+14 tests: GET/PATCH/DELETE `/:id` incl. 404s, invalid bodies,
param-validation 422s — asserting the repository is never reached on validation failures);
created `frontend/src/lib/http.test.ts` (9 tests covering every `request()` branch: JSON
success, header merging, 204, 422 message, string/detail fallbacks, network error wrapping,
abort re-throw); ran one `prettier --write` fix on its own file; left all non-test files
untouched and reported pre-existing WIP files honestly.

**Skills used:** `backend-testing` → `frontend-testing` → `verify-tests`.

**Result (independently re-verified):** backend 70/70 tests, `router.ts` 100% lines
(package 33%→47%); frontend 27/27 tests, `http.ts` 100% lines (package 48%→54%); typechecks and
coverage gates green in both packages.

## Assumptions

- Node >= 22.12 via `setup-node` (matches `engines`); the Prisma client is generated by `npm ci`
  postinstall, so tests never need a running database.
- The default model is free via OpenCode Zen, but the design is provider-agnostic within the four
  supported provider secrets; any other provider fails fast with a clear error.
- PRs from the same repository are the target; fork PRs are skipped (secrets).
- The backend has no formatter (semicolons/single quotes by convention); the frontend is
  Prettier-formatted. Both facts are encoded in the skills.

## Limitations

- **Fork PRs:** no repository secrets and a read-only token → the agent is skipped there (job-level
  condition). Supporting forks properly needs a GitHub App token or a `pull_request_target` pattern
  (larger attack surface — not taken by default).
- **GitHub Actions status:** everything runnable locally has been run and is documented above;
  the workflows themselves have **not** been executed on GitHub yet (see _Verification status_).
- **Free-model caveats:** Zen free models are offered "for a limited time" and may be rate-limited
  or less capable than paid models; the generated test quality depends on the model. If quality
  degrades, switch with the `OPENCODE_MODEL` repository variable (e.g. to a paid Zen model or
  another provider) — no other changes needed. Locally tested with GLM-5.3.
- **Residual exfiltration risk (inherent to the design):** the agent writes executable code
  (tests) that a verify job runs on a runner that also holds its own LLM key (outside the
  worktree). The permission allowlists, the out-of-worktree key file, and prompt-injection
  handling block the casual paths (probed), but a hostile model could still smuggble data through
  test output. Mitigations: GitHub masks secret values in logs, the report is human-visible on
  the PR, and the key should be a dedicated, low-limit, rotatable key. A fully hardened setup
  needs network egress control or ephemeral keys (see below).
- **Bash allowlist semantics:** patterns are matched per command; compound commands containing a
  disallowed part are rejected (probed), but the allowlist is a defense-in-depth hygiene layer,
  not a sandbox.
- **Agent nondeterminism:** the LLM decides _what_ to test. The deterministic verify job bounds
  the risk — nothing is published unless the full suites pass — but a weak model can produce
  shallow tests.
- **Improve mode cost:** one agent session over all audit targets can be long and token-heavy;
  it is manual and opt-in for that reason.
- **Race window:** a force-push during the run can make `git apply` fail in verify/publish; the
  concurrency group cancels stale runs, which minimizes it.

## What to extend or change for a production version

- Run the agent as a **GitHub App** (or OpenCode's official GitHub Action with OIDC) to support
  fork PRs and richer permissioning.
- Network egress control on the runner (or a key proxy with per-run scoped tokens) to close the
  residual exfiltration vector instead of documenting it.
- Cache `node_modules` between jobs; split backend/frontend verification into parallel jobs.
- Coverage deltas (base vs. head) in PR comments; per-target batching for improve mode.
- Persist agent session IDs per PR so re-runs continue a session instead of starting fresh.
- Model routing policy (cheap model for trivial diffs) with hard budget caps per run.
- Consider use more powerful models if results will not meet requirements
- Add independent security gates around the agent to mitigate prompt injection, prevent sensitive data exposure, and validate generated changes before execution or publication
