# Task 0134 - Regenerate AGENTS.md and committed dist for the normal default style

State: done
Owner: code-owner-0134
Mode: maintenance
Lane: docs
Type: docs
Scope: generated-instructions,dist,normal-default,docs
Risk: medium
Parallel: false
Depends on: none
Tags: docs

## Goal

Make the committed generated artifacts consistent with the already-committed normal-default communication style: regenerate `AGENTS.md` through the canonical export/sync flow and rebuild the committed `dist/`, so `apk lint` and `apk sync` pass again. This supersedes the remaining generated-artifact portion of canceled task 0124 without changing source, config, package metadata, or behavior.

## Context files

- AGENTS.md
- package.json
- scripts/copy-template-assets.mjs
- .agentic/config.json
- src/core/exporters/index.ts
- src/core/sync/index.ts
- docs/agent-exporters.md
- docs/decisions.md
- docs/progress.md

## Files allowed to edit

- AGENTS.md
- dist/**
- docs/progress.md
- src/core/init/init.test.ts

## Files forbidden to edit

- src/cli/**
- src/core/init/index.ts
- src/core/exporters/**
- src/core/sync/**
- src/core/templates/**
- .agentic/**
- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/0124-make-caveman-explicitly-user-opt-in-instead-of-an-automatic-default.md

## Steps

1. Confirm the style decision is already landed in source: `.agentic/config.json` `agentStyle` and `DEFAULT_AGENT_POLICY.defaultStyle` are `normal`, and `src/cli/commands/export.ts`/`src/core/sync/index.ts` already derive `styleRules` via `styleRulesFor`. This task regenerates the derived artifacts and repairs one broken test fixture only.
2. Reproduce the drift: `node dist/cli/index.js sync` must report `AGENTS.md` stale, and the committed `dist/` is behind `src/` because the style change did not rebuild it.
3. Rebuild the committed `dist/` from current source first so the built CLI is current: `pnpm build`. Do not edit `dist/` by hand.
4. Regenerate `AGENTS.md` with the existing config-aware flow: `node dist/cli/index.js sync --write`. Never hand-edit `AGENTS.md`.
5. Repair the broken fixture introduced by task 0124 in `src/core/init/init.test.ts`: the "fresh init ... normal default style" test calls an undefined `renderMinimalDocs`. Read the generated minimal docs (`docs/project.md`, `docs/scope.md`, `docs/architecture.md`) from the temp init directory with the already-imported `readFile`/`join` and assert none contains `caveman`. Do not change behavior or add imports.
6. Verify: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `node dist/cli/index.js lint --json`, and `node dist/cli/index.js sync`; the last two must exit 0 with no stale or missing generated file, and the test suite must pass.
7. Inspect the final diff: it must contain only `AGENTS.md`, generated `dist/**`, `src/core/init/init.test.ts`, this task file, and `docs/progress.md`. No runtime source, config, lockfile, or package change.
8. Commit the task-owned changes and progress update, then complete the policy-driven review/gate/done workflow.

## Acceptance criteria

- `AGENTS.md` matches the config-aware canonical rendering: concise `normal` prose that preserves reasons, limitations, and uncertainty, with no default caveman activation order.
- `node dist/cli/index.js sync` exits 0 and reports no stale or missing generated file.
- `node dist/cli/index.js lint --json` reports no `generated-file-stale` error and exits 0 (pre-existing historical-task policy warnings may remain).
- Committed `dist/` is rebuilt from current `src/`, and packaged template assets (including nested `.hbs` files) are present.
- The broken `src/core/init/init.test.ts` fixture is repaired to test init output without an undefined symbol, and `pnpm typecheck` and `pnpm test` pass.
- The change contains no runtime, config, dependency, lockfile, or behavior modification; `AGENTS.md` remains a generated artifact.
- All declared deterministic checks pass.
- `docs/progress.md` records the actual regenerated artifacts and the passing checks.

## Correctness assumptions

- The default-style source change (`DEFAULT_CONFIG.agentStyle`, `DEFAULT_AGENT_POLICY.defaultStyle`, `styleRulesFor`) is already committed; only derived artifacts are stale.
- `apk sync --write` is the canonical generator for `AGENTS.md` and is driven by the repository config.
- `pnpm build` is the canonical generator for `dist/` and copies `.hbs` template assets recursively.

## Invariants

- `AGENTS.md` is generated, never hand-authored; `dist/` is generated, never hand-authored.
- No runtime, config, package, or behavioral source change is introduced; only the broken test fixture is corrected.
- Only derived artifacts, the corrected test fixture, and progress bookkeeping are committed.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"sync-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js sync"}`

## Documentation updates

- docs/progress.md

## Notes

- Successor to canceled task 0124, which changed the default style in source but left `AGENTS.md` and `dist/` stale. Task 0124's implementation commit already includes the required `src/cli/commands/export.ts` change; no production-source edit is needed here.
- Scope is generated artifacts plus the one broken test fixture task 0124 introduced. If any other source defect appears, block this task instead of widening scope.
