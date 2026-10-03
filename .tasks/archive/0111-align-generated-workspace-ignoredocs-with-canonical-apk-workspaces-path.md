# Task 0111 - Generate canonical APK operational ignores during init and adoption

State: done
Owner: opencode-ds-v41
Mode: maintenance
Lane: workflow
Type: bugfix
Scope: init,adoption,gitignore,operational-state,workspaces,docs
Risk: medium
Parallel: false
Depends on: none
Tags: bugfix

## Goal

Make `apk init` and `apk adopt` establish the canonical APK operational/generated ignore contract additively and idempotently without destroying user `.gitignore` content. The contract covers APK runtime records under `.agentic/` (agents, runs, evidence, baselines, reviews, sessions, workspaces), the task/evidence locks, `.apk-workspaces/`, and generated audit/project-map reports.

Two independent downstream repositories demonstrated that requiring integration agents to reconstruct APK's ignore rules manually is error-prone:

- ResLedger tracked `.agentic/agents/<agent>.json` and `.agentic/runs/<run>.jsonl` and omitted `.apk-workspaces/`.
- translator-agent independently exposed stale `.apk-worktrees/` versus the canonical `.apk-workspaces/` naming.

Canonical APK-owned operational/generated ignore entries expected (audit the actual current implementation and the APK repository `.gitignore`):

- `.tasks/.apk.lock`
- `.agentic/agents.jsonl`
- `.agentic/runs.jsonl`
- `.agentic/agents/*`
- `!.agentic/agents/.gitkeep`
- `.agentic/runs/*`
- `!.agentic/runs/.gitkeep`
- `.agentic/evidence.jsonl`
- `.agentic/task-baselines.jsonl`
- `.agentic/evidence.append.lock`
- `.agentic/reviews/*`
- `.agentic/sessions/*`
- `.agentic/workspaces/*`
- `.apk-workspaces/`
- `docs/audit-report.md`
- `docs/project-map.md`

Do not blindly copy unrelated APK-repository development ignores such as its own `node_modules/`, npm logs, environment files, OpenCode package files, or build output. This task concerns APK-owned generated/operational state only.

`.gitignore` rules do not untrack files that Git already tracks. A brownfield repository may already contain tracked APK-owned runtime records such as `.agentic/agents/<agent>.json` and `.agentic/runs/<run>.jsonl`. After canonical ignore rules are added those files remain tracked. `apk init` and `apk adopt` must not automatically delete or untrack user files, must never run `git rm --cached`, and must not silently report repository hygiene as fully fixed while tracked APK-owned operational/generated paths remain. That state must be explicitly detected (using read-only Git queries) and surfaced as a bounded diagnostic/remediation finding or an equivalent safe warning, so the user or agent can separately decide whether to untrack those files.

## Context files

- AGENTS.md
- .gitignore
- docs/task-system.md
- docs/decisions.md
- README.md
- src/core/init/index.ts
- src/core/init/init.test.ts
- src/core/docs/adopt.ts
- src/core/workspaces/index.ts
- src/cli/cli.test.ts

## Files allowed to edit

- src/core/workspaces/index.ts
- src/core/init/index.ts
- src/core/init/init.test.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/cli/cli.test.ts
- src/cli/commands/init.ts
- src/cli/commands/adopt.ts
- docs/task-system.md
- docs/decisions.md
- docs/progress.md
- README.md
- dist/**

## Files forbidden to edit

- src/core/execution/**
- src/core/work/**
- src/core/tasks/**
- .github/workflows/**

## Steps

1. Capture the downstream reproducers: ResLedger tracked `.agentic/agents/*.json` and `.agentic/runs/*.jsonl` and omitted `.apk-workspaces/`; translator-agent exposed stale `.apk-worktrees/`.
2. Define the canonical APK-owned operational/generated ignore set from the actual implementation and the APK repository `.gitignore`.
3. Implement additive, idempotent, deterministic `.gitignore` generation for `apk init` and `apk adopt`; preserve existing content, comments, and unrelated rules.
4. Handle a missing `.gitignore`, an existing `.gitignore`, a missing trailing newline, and avoid duplicate entries; never emit `.apk-worktrees/`.
5. Update canonical docs to name `.apk-workspaces/` and describe the generated ignore contract.
6. Detect already-tracked APK-owned operational/generated paths with read-only Git queries and surface a bounded diagnostic/remediation finding; never delete or untrack them automatically.
7. Add regression tests and run verification.

## Acceptance criteria

- fresh `apk init` creates or adds the canonical APK operational ignore block.
- fresh `apk adopt` creates or adds it.
- existing custom `.gitignore` content survives byte-semantically except for the bounded additive APK entries and the newline needed for append.
- a second init/adopt-compatible operation does not duplicate entries.
- `.agentic/agents/*` and `.agentic/runs/*` runtime records are ignored while `.gitkeep` remains trackable.
- evidence, baseline, session, review, and workspace runtime state is ignored.
- `.apk-workspaces/` is ignored.
- generated audit/project-map files follow canonical policy.
- generated output never introduces `.apk-worktrees/`.
- workspace safety and runtime semantics themselves are unchanged.
- existing tracked APK-owned operational state is surfaced explicitly; adding ignore rules must not silently report the repository as clean with respect to those tracked files, and APK must never automatically delete or untrack them.

## Correctness assumptions

- the runtime constant `.apk-workspaces` is canonical.
- init and adopt currently emit no `.gitignore` entry so a safe additive generator is required.
- an existing user `.gitignore` may have no trailing newline or may already contain some APK entries.
- a stale `.apk-worktrees/` line is not proven to be an exact APK-generated artifact and is not aggressively removed; adding the correct `.apk-workspaces/` rule is sufficient.
- a brownfield repository may already have tracked APK-owned runtime records, so adding ignore rules does not untrack them; detecting such paths requires only read-only Git queries and must not mutate the index.

## Invariants

- existing user `.gitignore` content, comments, and unrelated rules are never destroyed.
- no general-purpose `.gitignore` formatter or parser is introduced.
- workspace safety and runtime semantics are unchanged.
- generated output never uses `.apk-worktrees/` as the canonical path.
- APK never runs `git rm --cached`, `git add`, or any index/working-tree mutation for hygiene.
- tracked APK-owned operational state is reported, never silently deleted or silently treated as clean.

## Required evidence

- regression test output for init and adopt plus the generated ignore block for a fresh and a customized `.gitignore`.
- regression test output showing a tracked `.agentic/runs/foo.jsonl` remains present and tracked after init/adopt, with an explicit diagnostic and no `git rm --cached`.

## Review questions

- Is the generated ignore additive, idempotent, and byte-preserving for existing content?
- Are agents/runs records ignored while `.gitkeep` stays trackable?
- Is `.apk-workspaces/` canonical and `.apk-worktrees/` never generated?
- Does init/adopt surface tracked APK-owned operational state instead of silently reporting hygiene as fixed?
- Is there any automatic index mutation or `git rm --cached`?

## Counterexample searches

- missing `.gitignore`
- existing `.gitignore` with no trailing newline
- existing `.gitignore` already containing `.apk-workspaces/`
- customized `.gitignore` with comments and unrelated rules
- CRLF line endings
- stale `.apk-worktrees/` line present
- repository already tracks `.agentic/runs/foo.jsonl` before init/adopt
- tracked `.agentic/agents/<agent>.json` present
- read-only Git queries must not mutate the index

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"workspace-constant","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node --input-type=module -e \"import { DEFAULT_WORKSPACE_BASE } from './dist/core/workspaces/index.js'; if (DEFAULT_WORKSPACE_BASE !== '.apk-workspaces') { throw new Error('unexpected workspace base: ' + DEFAULT_WORKSPACE_BASE); }\""}`
- `{"id":"built-sync","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js sync"}`
- `{"id":"built-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js lint"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- docs/task-system.md
- docs/decisions.md
- docs/progress.md

## Notes

- Keep the fix narrow and limited to APK-owned operational/generated ignore state.
- Prefer a bounded block that is appended once and matched idempotently; do not reformat the rest of the file.
- Scope expanded to `src/cli/commands/init.ts` and `src/cli/commands/adopt.ts` so the tracked-operational-state diagnostic is actually surfaced to the user running `apk init`/`apk adopt`; the canonical ignore logic stays in core.
