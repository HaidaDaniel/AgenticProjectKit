# Task 0147 - Make manual verification artifacts satisfiable and internally coherent

State: todo
Owner: none
Mode: maintenance
Lane: verification
Type: bugfix
Scope: verification,evidence,policy,gate,artifact,cli,tests,docs
Risk: high
Parallel: false
Depends on: 0057,0058,0062,0096
Tags: bugfix,verification,evidence,policy,gate,artifact

## Goal

Ensure no accepted verification contract declares an artifact requirement that the supported APK workflow cannot record and satisfy, while preserving a clear distinction between evidence references and artifact references.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/cli-commands.md
- docs/progress.md
- src/core/tasks/index.ts
- src/core/tasks/evidence.ts
- src/core/tasks/policy.ts
- src/core/tasks/gate.ts
- src/cli/commands/task.ts
- src/core/tasks/task.test.ts
- src/cli/cli.test.ts
- .tasks/0057-structured-task-verification-contract-with-backward-compatibility.md
- .tasks/0058-add-first-class-task-evidence-records.md
- .tasks/0062-gate-task-completion-on-verification-scope-policy-and-evidence.md
- .tasks/0096-record-externally-observed-manual-and-live-verification-evidence.md
- .tasks/0119-add-first-class-human-decisions-for-exhausted-review-budgets.md

## Files allowed to edit

- src/core/tasks/index.ts
- src/core/tasks/evidence.ts
- src/core/tasks/policy.ts
- src/core/tasks/gate.ts
- src/cli/commands/task.ts
- src/core/tasks/task.test.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/cli-commands.md
- docs/architecture.md
- docs/decisions.md
- docs/progress.md
- dist/**
- .tasks/0147-make-manual-verification-artifacts-satisfiable-and-internally-coherent.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- .agentic/config.json
- .github/**
- src/core/execution/**
- src/core/workspaces/**
- src/core/resources/**
- src/core/tasks/workflow.ts
- .tasks/archive/**

## Steps

1. Trace artifact declaration and category projection through structured task parsing, automated verification, external manual recording, evidence normalization, freshness, policy, and gate matching.
2. Choose and document one canonical meaning for artifact: a record metadata/reference, a separately satisfiable category, or an explicitly rejected unsupported declaration; keep the design generic and minimal.
3. Align parser validation, verification record shape, manual/live CLI or API recording, policy declaration, category matching, and gate behavior so every accepted declaration has a supported satisfiable path.
4. Preserve candidate-bound evidence and do not claim arbitrary external artifact existence or trust beyond what APK can validate.
5. Add deterministic core and CLI regressions for manual artifact pass/fail, unavailable placeholders, automated artifact behavior, missing references, stale evidence, malformed contracts, and existing manual-with-evidence behavior.
6. Run focused and full verification, rebuild committed dist, and update canonical documentation for evidence versus artifact references.

## Acceptance criteria

- No valid verification contract declares an evidence category that the supported parser, verifier, recorder, policy, and gate paths cannot satisfy.
- The implementation selects and documents one canonical artifact semantic; it does not leave artifact half-category and half-metadata behavior.
- A manual check with an artifact reference is either fully supported through an explicit candidate-bound recording path or rejected early with an actionable validation error.
- A successful external manual artifact result, when supported, has an unambiguous check identity, result, artifact/reference representation, and current candidate subject.
- A manual fail, unavailable local placeholder, missing reference, stale subject, different candidate, or malformed contract never satisfies the artifact or verification gate.
- Automated artifact behavior remains valid and does not regress.
- An artifact or artifact reference cannot satisfy unrelated benchmark, report, live, manual, evidence, or other categories by incidental text or field presence.
- APK does not claim existence, integrity, or trust of arbitrary external files unless the selected contract explicitly provides a supported validation mechanism.
- Existing manual-with-evidence recording behavior remains compatible, including candidate freshness and no direct evidence.jsonl editing requirement.
- Policy, verify, evidence, gate, CLI help, templates where applicable, and docs describe the same artifact semantics.

## Correctness assumptions

- TaskVerificationCheck currently allows artifact?: string and policy adds artifact when present.
- Automated verify copies check.artifact into the evidence record, but recordManualVerification currently writes only the external evidence reference and summary.
- Task 0096 fixed the separate manual/live category mismatch for one typed record, but it did not make manual artifact declarations coherent.
- An artifact path/reference and an externally observed evidence reference are different concepts and may need different trust and validation rules.
- The smallest safe design may reject unsupported manual artifact declarations, but such rejection must happen before a contract becomes gateable.

## Invariants

- A contract cannot pass parser or policy validation while its required artifact category has no supported recording path.
- Gate eligibility remains candidate-bound and requires a current passing result; unavailable, failed, stale, and different-candidate records remain non-satisfying.
- Artifact metadata cannot masquerade as an unrelated evidence category.
- Automated artifact evidence does not lose its existing semantics.
- Manual external recording remains explicit, owner-checked, bounded, append-only, and free of implicit passes.
- APK distinguishes a reference supplied by an observer from existence or trust validation of an external artifact.
- No second evidence or policy engine and no translator-agent-specific exception is introduced.

## Required evidence

- A v0.4.6 reproducer showing a required manual check with artifact declares artifact evidence but --record cannot carry artifact into the external evidence record.
- A deterministic supported-or-rejected manual artifact test proving the selected canonical semantics.
- Regression output for manual pass, fail, unavailable local verify, missing artifact/reference, stale and different-candidate evidence, and malformed contract.
- Automated artifact verification and existing manual-with-evidence regressions.
- Negative gate tests proving artifact cannot satisfy unrelated categories or bypass candidate freshness.
- CLI output showing the artifact/reference contract and actionable errors without manual evidence-file edits.
- Typecheck, lint, focused tests, full tests, build, dist currency, and git diff checks for the committed candidate.

## Review questions

- Is artifact consistently metadata, a category, or an unsupported declaration across parser, policy, record, CLI, and gate?
- Can a manual artifact contract still be accepted while no supported command can satisfy it?
- Can an unavailable local placeholder or free-text reference produce a false pass?
- Can artifact presence satisfy benchmark, report, live, manual, or generic evidence categories accidentally?
- Are automated artifact records unchanged and candidate-bound?
- Does the design avoid pretending to validate arbitrary external file existence or trust?
- Does the user receive a bounded actionable error when the selected artifact semantics cannot be fulfilled?

## Counterexample searches

- Required manual check with artifact and no evidence reference.
- Required manual check with artifact plus evidence, followed by --record pass.
- Manual artifact --record fail and a later local verify that writes unavailable.
- Artifact record for candidate A evaluated against candidate B or a changed HEAD.
- Missing, empty, malformed, or overlong artifact/reference values.
- Artifact text naming a benchmark, report, live URL, or manual observation.
- Automated report check with artifact after the change.
- Existing manual/live check with evidence but no artifact after the change.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-task-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx --test src/core/tasks/task.test.ts"}`
- `{"id":"focused-cli-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx --test src/cli/cli.test.ts"}`
- `{"id":"full-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"verification-report","type":"automated","required":true,"environment":"static","profile":"report","command":"pnpm exec apk task policy 0147"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update docs/task-system.md with the selected artifact semantics, manual/external recording behavior, category declaration rules, and evidence-reference versus artifact-reference distinction.
- Update docs/cli-commands.md with the supported manual artifact command or the early validation error and its remediation.
- Update docs/architecture.md if the evidence record boundary or artifact trust model changes.
- Update docs/decisions.md with the canonical artifact decision and rejected half-supported alternatives.
- Update docs/progress.md when the implementation task changes status.

## Notes

- Confirmed v0.4.6 defect: policy.ts declares artifact whenever a check has artifact, automated verify copies it to evidence, but recordManualVerification accepts only owner/check/result/evidence/summary and never records check.artifact; a successful manual external record cannot satisfy the declared artifact category.
- Downstream provenance: translator-agent removed artifact from a manual check and put the path in free-text evidence to work around the missing recording path.
- Task 0096 is a partial neighbor, not a duplicate: it made manual/live evidence recordable and corrected the one-record live/manual category projection, but it did not resolve artifact semantics for manual checks.
- This task is intentionally separate from Task 0146 because artifact reference/category semantics have different invariants and regression surface from benchmark result typing.
- Keep every list element in this task file on one physical Markdown line until Task 0145 is implemented.
