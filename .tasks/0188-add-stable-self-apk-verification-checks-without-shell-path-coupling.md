# Task 0188 - Add stable self-APK verification checks without shell-path coupling

State: doing
Owner: codex-continue-20261005-2055
Mode: product
Lane: tooling
Type: refactor
Scope: verification,cli,executable-resolution,task-contract,portability
Risk: high
Parallel: false
Depends on: 0186
Tags: verification,cli,portability,dogfood

## Goal

Remove unnecessary coupling between task contracts and the physical APK launcher path/package-manager spelling.

Provide a backward-compatible first-class way for verification checks that invoke APK itself (lint, doctor, sync/status/audit where safe) to use the currently resolved repository APK implementation without hard-coding pnpm exec apk, ./node_modules/.bin/apk, or the compatibility alias.

Host-project commands remain ordinary explicit shell commands.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/cli-commands.md
- docs/engineering/testing-strategy.md
- src/core/tasks/index.ts
- src/core/tasks/evidence.ts
- src/cli/commands/task.ts
- src/cli/index.ts
- .tasks/0186-harden-task-contract-authoring-evidence-and-path-ergonomics.md

## Files allowed to edit

- src/core/tasks/**
- src/cli/**
- src/core/docs/prompt.ts
- src/core/docs/prompt.test.ts
- src/core/templates/task-templates.ts
- src/core/templates/**
- dist/**
- docs/task-system.md
- docs/cli-commands.md
- docs/engineering/testing-strategy.md
- docs/progress.md
- .tasks/0188-add-stable-self-apk-verification-checks-without-shell-path-coupling.md

## Files forbidden to edit

- src/core/scanners/**
- src/core/execution/**
- package.json
- pnpm-lock.yaml
- .github/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. Reproduce a structured verification contract that only works after changing pnpm exec apk to ./node_modules/.bin/apk in a constrained environment.
2. Choose the smallest backwards-compatible schema for self-APK checks: a typed/builtin APK operation or a resolver token interpreted by the verifier. Do not introduce a generic shell templating language.
3. Resolve the same executable/version that is already running or the repository-pinned APK according to the canonical executable-discovery contract.
4. Allow only a bounded operation vocabulary with explicit mutating/non-mutating semantics; verification must not accidentally run a writing command where a read-only check is expected.
5. Keep all existing command checks valid unchanged.
6. Update built-in templates/guidance to use the stable form for APK-owned checks while leaving host quality commands explicit.
7. Cover Windows path/shim behavior and Linux/macOS path quoting.
8. Regenerate committed dist.

## Acceptance criteria

- A task can declare an APK lint/doctor-style check without embedding pnpm, node_modules/.bin, PATH assumptions, or the legacy apk alias.
- The check executes the repository/current APK version deterministically and records the resolved identity in evidence/provenance where appropriate.
- Existing shell command verification remains fully supported.
- No arbitrary executable-discovery fallback can silently select a different global APK version.
- Mutating APK operations are either excluded from builtin verification or explicitly modeled so a supposedly read-only check cannot write the repository.
- Canonical public CLI naming may remain apkit while old apk task contracts continue to work.
- Windows and POSIX tests cover spaces/quoting/shims.
- translator-agent-shaped constrained execution no longer needs to rewrite the task contract solely to find APK.

## Correctness assumptions

- The verifier has more reliable knowledge of APK identity than a task Markdown author.
- Only APK-self checks need this abstraction; host tool commands should stay transparent.

## Invariants

- No global-version drift.
- No generic command-template expansion.
- Backward compatibility for all existing verification command records.
- Evidence remains candidate-bound.

## Required evidence

- Reproducer for launcher-path failure: `builtin APK operations ignore unavailable launchers, shims, and spaced roots`.
- Cross-platform resolver/builtin tests: the same fixture covers a spaced POSIX root, Windows-style `.cmd`/`.ps1` shims, and a PATH containing only the shim directory; the runtime dispatcher test covers fail-closed operation bounds.
- Legacy command compatibility regression: `legacy verification commands remain shell-backed after builtin support`.
- Candidate-bound verification evidence must include the quality/coverage run that executes these source tests.

## Review questions

- Can the builtin resolve a different APK version from the one governing the repository?
- Can it mutate files unexpectedly?
- Does it remain usable from a Git-tag install and APK's own source repository?

## Counterexample searches

- No node_modules bin link.
- pnpm unavailable but current APK process is running.
- Global apkit earlier on PATH.
- Windows shim path with spaces.
- APK source repository before/after build.

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint","evidenceRef":"task-lint-source-tests"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Document the stable self-APK check form and exactly when ordinary shell commands remain preferred.

## Notes

- translator-agent had to replace pnpm exec apk with ./node_modules/.bin/apk in a task contract because only the latter executable path was available in that environment.
- This task follows 0186 because both change verification-check parsing/authoring.
