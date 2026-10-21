# Task 0234 - Diagnose unreproducible APK installations and launcher mismatches

State: done
Owner: codex-fixes-0234
Mode: maintenance
Lane: diagnostics
Type: feature
Scope: doctor,adoption,installation,docs
Risk: medium
Parallel: false
Depends on: 0231,0233
Tags: p2,installation,diagnostics

## Goal

Add bounded read-only installation diagnostics to doctor and adoption preview so a configured repository can distinguish repository-pinned APK from an undeclared prerequisite; missing local launcher payload; mismatched launch paths or insufficient evidence.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- docs/decisions.md
- docs/research/non-node-apk-installation-and-distribution.md
- docs/engineering/apk-upgrade-workflow.md
- src/core/doctor/index.ts
- src/core/docs/adopt.ts
- src/core/config/compatibility.ts
- src/core/doctor/doctor.test.ts
- src/core/docs/adopt.test.ts

## Files allowed to edit

- src/core/doctor/index.ts
- src/core/doctor/installation.ts
- src/core/doctor/doctor.test.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- docs/adoption-flow.md
- docs/engineering/apk-upgrade-workflow.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- pnpm-lock.yaml
- .agentic/**
- .tasks/archive/**
- docs/releases/**
- package.json
- src/core/tasks/**
- src/core/config/schema.ts
- src/core/config/types.ts

## Steps

1. Create synthetic fixtures for a pinned package plus matching lock entry; a configured repository with README commands but no installation declaration; and a wrapper pointing at a missing .tools/AgenticProjectKit/dist/cli/index.js payload.
2. Define the bounded evidence model before coding: inspect declared package and lock metadata plus documented invocation and simple literal wrapper targets. Keep declared; locked; present and unknown facts distinct. Do not interpret arbitrary shell programs or execute wrappers.
3. Reuse one diagnostic projection in doctor and planAdoption. Classify missing installation instructions; unresolved pins; absent wrapper targets and disagreeing documented launch paths. A running globally available APK does not establish reproducibility of the repository.
4. Treat documented external installation as an explicit prerequisite; report its version/source evidence or lack thereof. Unsupported package-manager formats and dynamic launchers remain unknown with a reason rather than falsely missing or reproducible.
5. Keep ADR-0057 repository-local pinning as the supported default and ADR-0058 upgrades as agent/operator compositions. Provide manual remediation guidance without installing dependencies or requiring Node application semantics for Python/Go.
6. Add deterministic tests with offline fixtures and command-execution sentinels; document the supported inspection boundaries and remaining downstream work.

## Acceptance criteria

- Doctor and adopt --preview report consistent installation findings with evidence paths and explicit unknown cases.
- A configured repository without a declared reproducible installation path receives an actionable warning even when the executing APK is available on PATH.
- An absent literal wrapper target and a documented pnpm exec apk invocation without a corresponding local installation are diagnosed distinctly.
- A matching pinned package and supported lockfile are recognized as reproducible declarations without claiming that an install or launch was successfully performed.
- Python/Go repositories and explicitly documented external prerequisites are not automatically modified or treated as broken Node applications.
- Inspection is bounded and read-only; it performs no network access; dependency installation; bootstrap execution or arbitrary shell evaluation. Unknown formats remain visible.

## Correctness assumptions

- A missing APK dependency alone does not prove a defect when the README explicitly requires a separate installation.
- Availability on this machine does not prove that a clean checkout can reproduce the tool version.

## Invariants

- No automatic package mutation; lockfile mutation; new distribution mechanism; global installation or config schema change.
- No secret values or unbounded script contents in diagnostics.
- Do not change application-runtime detection or erase legitimate Task 0231 findings.

## Required evidence

- Fixture outputs for each installation state and consistent doctor/adoption reporting.
- Read-only snapshots and execution sentinels proving that detection did not run project scripts.

## Review questions

- Does each conclusion distinguish observed metadata from a successful installation?
- Can unsupported lockfiles or dynamic wrappers produce a false reproducible result?
- Is the remediation useful without forcing dependencies into a downstream project?

## Counterexample searches

- Documented separate installation with a pinned source; a global executable only; stale lock metadata; missing package manifest.
- Symlinked or external wrapper target; shell variables; recursive scripts; malformed manifests; oversized instructions.
- Python plus APK-only tooling; Go with no Node manifest; genuine mixed Node application.

## Verification

- `{"id":"focused-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/doctor/doctor.test.ts src/core/docs/adopt.test.ts"}`
- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"task-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document diagnostic states and manual installation reconciliation in docs/adoption-flow.md and docs/engineering/apk-upgrade-workflow.md.
- Update docs/progress.md when task state changes.

## Notes

- Planning requested by the operator after the read-only downstream audit on 2026-10-20 at APK commit 5891ca51e9b9b7848a4d3237517b1d1ca6052ba0. This contract authorizes only its own future scope; no implementation is claimed.
- Use synthetic disposable repositories. Do not modify downstream repositories or infer consent for their migration.
- Parallel is false. Shared source files and docs/progress.md require sequential work in this checkout; separate worktrees and explicit integration are required for concurrent mutable work. Do not claim while another doing or review task owns this checkout.
- Commit the final candidate before canonical verification. Run the declared verification set once per unchanged candidate; do not prepend overlapping full-suite or release checks.
- Priority P2. Search Forge had no APK dependency or lock entry but README explicitly said after installing the kit. Classify this as an unspecified external installation prerequisite rather than a proven broken pnpm install.
- The ai-bench wrapper/bootstrap case was supplied by the operator and was not independently accessible during the audit. Reproduce that structural case synthetically; do not assert a verified downstream failure.
- Depends on 0231 for doctor and test-file integration; 0233 lands first so archive safety remains the first corrective delivery.
