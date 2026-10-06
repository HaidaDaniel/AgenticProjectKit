# Task 0185 - Separate application runtime from repository tooling semantics

State: doing
Owner: codex-continue-20261005-2055
Mode: product
Lane: architecture
Type: refactor
Scope: scanners,audit,project-map,adoption,non-node,tooling
Risk: high
Parallel: true
Depends on: 0122,0125
Tags: scanners,non-node,dogfood,architecture

## Goal

Implement the accepted Task 0125 conclusion that APK-owned Node tooling must not, by itself, imply a Node.js application runtime.

Represent application/runtime evidence separately from repository tooling/control-plane evidence while preserving legitimate mixed applications such as Go backend plus a real React/Node frontend.

## Context files

- AGENTS.md
- docs/research/non-node-apk-installation-and-distribution.md
- docs/engineering/scanner-system.md
- docs/architecture.md
- docs/decisions.md
- docs/progress.md
- .tasks/archive/0125-research-non-node-apk-installation-and-distribution.md
- .tasks/archive/0122-align-repository-readiness-test-findings-with-detected-test-capability.md
- src/core/scanners/index.ts
- src/core/audit/index.ts
- src/core/config/schema.ts
- src/core/docs/adopt.ts

## Files allowed to edit

- src/core/scanners/**
- src/core/audit/**
- src/core/config/**
- src/core/docs/adopt.ts
- src/core/docs/*.test.ts
- src/core/templates/**
- dist/**
- docs/engineering/scanner-system.md
- docs/adoption-flow.md
- docs/architecture.md
- docs/decisions.md
- docs/progress.md
- .tasks/0185-separate-application-runtime-from-repository-tooling-semantics.md

## Files forbidden to edit

- src/core/tasks/**
- src/core/execution/**
- package.json
- pnpm-lock.yaml
- .github/**
- .tasks/archive/**
- docs/releases/**

## Steps

1. Add synthetic dogfood fixtures equivalent to translator-agent (Python app plus root APK tooling manifest) and ResLedger (Go app plus root APK/dev tooling manifest).
2. Define a backward-compatible scan projection that distinguishes application/runtime components from tooling/control-plane components.
3. Treat package.json presence as Node tooling evidence, not sufficient application-runtime proof, when APK/tooling ownership is established.
4. Preserve actual Node application detection using stronger component/workspace/runtime evidence; Python/Go plus a genuine Node frontend must remain a mixed application.
5. Add one bounded optional explicit manifest-role override for ambiguous repositories rather than growing unbounded heuristics.
6. Propagate the distinction through Project Map, audit/readiness, adoption guidance, and generated wording without changing APK distribution.
7. Keep legacy consumers of the flat detectedStack projection compatible where practical and document any additive fields.
8. Regenerate committed dist.

## Acceptance criteria

- Python + APK-only package.json reports Python as application runtime and Node/pnpm/APK as repository tooling, not Node as an application solely because package.json exists.
- Go + APK/tooling package.json reports Go as application runtime and Node/pnpm/APK as tooling.
- Go/Python plus a genuine Node/React/Next application component reports both application runtimes/components.
- The classifier never globally suppresses Node just because Python/Go/Rust/.NET evidence exists.
- Ambiguous cases resolve conservatively to mixed/unknown or a small explicit manifest-role override.
- APK install/distribution remains repository-local package.json + pnpm as accepted by Task 0125; this task does not move tooling or add a new installer.
- Readiness findings consume capability/runtime semantics rather than reverting to package.json-as-application assumptions.
- Existing Python/Go marker behavior from Task 0112/0122 remains intact.

## Correctness assumptions

- Repository tooling and application runtime are orthogonal dimensions.
- Manifest filename presence alone is insufficient ownership evidence.

## Invariants

- No runtime is hidden when credible application evidence exists.
- APK distribution and exact-pin guarantees do not change.
- Classification is deterministic and read-only.

## Required evidence

- Synthetic fixtures for Python+APK, Go+APK, and mixed Go/Python+real Node application.
- Before/after Project Map and audit projections.

## Review questions

- Could a real Node app be mislabeled tooling-only?
- Does explicit metadata override only ownership semantics, not fabricate capabilities?
- Are third-party/root-manifest limitations documented honestly?

## Counterexample searches

- Monorepo with root APK package and nested frontend.
- Node CLI application that also depends on APK.
- package.json containing APK plus Vite/React.
- workspace-only Node app.
- ambiguous package.json with no APK dependency.

## Verification

- `{"id":"quality","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm quality","evidence":"full quality output summary"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json","evidence":"task lint JSON output"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Document application/runtime versus tooling/control-plane semantics and the bounded explicit ownership override.

## Notes

- Task 0125 already researched distribution alternatives and concluded KEEP CURRENT MODEL. Do not reopen that decision here.
- Current scanner still starts Node stack detection from package.json existence, so the accepted semantic follow-up remains unimplemented.
- This task intentionally avoids src/core/tasks and can run in parallel with 0183/0184 after normal Git/worktree isolation.
