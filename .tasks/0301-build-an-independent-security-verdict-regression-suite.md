# Task 0301 - Build an independent security-verdict regression suite

State: done
Owner: opencode-corrective-impl
Mode: audit
Lane: verification
Type: security
Scope: tests,security,doctor,gate,containment
Risk: high
Parallel: false
Depends on: 0290,0291,0292,0294
Tags: security,tests,oracle,verdicts,assurance

## Goal

Verify APK security verdicts against an independently constructed oracle so APK cannot validate itself using the same faulty assumptions that produced the audit findings.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- src/core/doctor/index.ts
- src/core/tasks/gate.ts
- src/core/config/paths.ts

## Files allowed to edit

- src/core/security/verdict-oracle.test.ts
- scripts/benchmarks/verdict-oracle-fixture.mjs
- docs/architecture.md

## Files forbidden to edit

- .tasks/**
- .agentic/**
- src/core/exporters/index.ts
- src/core/audit/index.ts
- src/core/doctor/index.ts
- src/core/tasks/gate.ts
- package.json
- pnpm-lock.yaml
- .github/**

## Steps

1. Construct fixtures whose expected verdicts are derived from ground-truth filesystem and Git state by an oracle independent of APK helpers family tables and blocker text.
2. Cover the four confirmed defect classes: deletion escape write escape ignore-rule false pass and self-certification of a safety verdict.
3. Add negative controls that reintroduce each original defect pattern in a fixture and require the suite to fail against it.
4. Assert doctor gate and containment refusals match the oracle including unavailable inspection cases.
5. Run the suite against a clean repository state and record that it does not depend on APK review or gate evidence.
6. Run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- Expected verdicts come from an independently constructed oracle not from APK policy or blocker strings.
- Each of the four confirmed defect classes has a fixture and a negative control.
- The suite fails on a fixture reproducing the original defect and passes on the corrected behavior.
- The suite uses no APK review or gate evidence as its own authority.
- No paid model call or downstream mutation occurs.

## Correctness assumptions

- An external oracle can be constructed without sharing APK inference code

## Invariants

- APK cannot certify its own security verdict from the same assumptions under test

## Required evidence

- Oracle construction description and negative-control results

## Review questions

- Does any oracle input come from APK policy output

## Counterexample searches

- Oracle importing APK helpers; Expected values copied from implementation output; Missing negative control

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-regressions","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/security/verdict-oracle.test.ts"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"oracle-negative-controls","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Record each negative control proving the suite detects the original defect pattern."}`

## Documentation updates

- Document the independent verdict oracle in docs/architecture.md

## Notes

- Justified as a separate task because 0292 only covers ignore semantics and 0300 only covers mutation sites
- Trust boundary: independent verification rather than implementation or inventory
- Pre-existing untracked .tasks/0285 and docs/adoption-report.md are unrelated WIP and must not be touched
