# Task 0146 - Make benchmark evidence a satisfiable first-class verification contract

State: todo
Owner: none
Mode: maintenance
Lane: verification
Type: bugfix
Scope: verification,evidence,policy,gate,benchmark,cli,tests,docs
Risk: high
Parallel: false
Depends on: 0058,0059,0061,0062
Tags: bugfix,verification,evidence,policy,gate

## Goal

Give Type: benchmark tasks one canonical end-to-end verification contract that can declare benchmark evidence, record a real candidate-bound benchmark result through supported APK APIs or CLI, and satisfy the completion gate without weakening category or freshness checks.

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
- src/core/templates/task-templates.ts
- src/cli/commands/task.ts
- src/core/tasks/task.test.ts
- src/cli/cli.test.ts
- .tasks/0058-add-first-class-task-evidence-records.md
- .tasks/0059-execute-task-verification-profiles-and-record-evidence.md
- .tasks/0061-introduce-risk-and-task-policy-requirements.md
- .tasks/0062-gate-task-completion-on-verification-scope-policy-and-evidence.md
- .tasks/0065-add-typed-task-templates-with-domain-specific-guardrails.md
- .tasks/0096-record-externally-observed-manual-and-live-verification-evidence.md
- .tasks/0119-add-first-class-human-decisions-for-exhausted-review-budgets.md

## Files allowed to edit

- src/core/tasks/index.ts
- src/core/tasks/evidence.ts
- src/core/tasks/policy.ts
- src/core/tasks/gate.ts
- src/core/templates/task-templates.ts
- src/cli/commands/task.ts
- src/core/tasks/task.test.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/cli-commands.md
- docs/architecture.md
- docs/decisions.md
- docs/progress.md
- dist/**
- .tasks/0146-make-benchmark-evidence-a-satisfiable-first-class-verification-contract.md

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

1. Trace the current Type: benchmark path from parser and template through policy declaration, verification execution or external recording, evidence typing, freshness, and gate matching.
2. Choose and document one minimal generic declaration-to-evidence model for benchmark results, reusing the existing evidence store and avoiding a second policy engine or translator-specific exception.
3. Implement the canonical local or externally observed recording path, including candidate, baseline, worktree, HEAD, result, and benchmark identity validation needed for gate eligibility.
4. Align policy declaration, per-check verification evidence, category matching, CLI help, task creation templates, and human-readable policy/gate output with the chosen model.
5. Add deterministic end-to-end regressions for success, failure, unavailable/not-run, stale and different-candidate evidence, category masquerading, and non-benchmark compatibility.
6. Run focused and full verification, rebuild committed dist, and update canonical evidence/policy documentation.

## Acceptance criteria

- A normal Type: benchmark task parses, renders, passes lint and policy validation, and has no unsatisfiable declaration blocker solely because benchmark evidence is required.
- The benchmark task definition explicitly declares the benchmark category through one documented canonical verification mechanism.
- A real successful benchmark execution or externally observed benchmark recording creates typed benchmark evidence that is candidate-bound and gate-eligible through supported APK workflow.
- A current passing benchmark result satisfies both the required benchmark verification check and the benchmark policy category.
- Failed, unavailable, pending, and not-run benchmark results never satisfy the benchmark check or category gate.
- Benchmark evidence from a stale baseline or different candidate cannot satisfy a new candidate gate and remains visible only as history/provenance.
- Manual, report, automated-test, live, artifact, and generic evidence records cannot masquerade as benchmark evidence because their type and declaration do not match.
- Automated deterministic tests are not typed or accepted as benchmark results unless the contract explicitly uses the real benchmark recording path and a benchmark actually ran.
- The supported CLI or API recording path does not require hand-editing .agentic/evidence.jsonl and reports the benchmark declaration and result clearly in policy, verify, evidence, and gate output.
- Existing non-benchmark tasks, evidence categories, candidate freshness, and completion semantics remain unchanged.
- No second parallel policy engine or translator-agent-specific special case is introduced.

## Correctness assumptions

- The current policy adds benchmark as a required category for the benchmark tag and Type: benchmark, while declaredEvidenceCategories cannot currently emit benchmark.
- src/core/tasks/evidence.ts already supports evidence type benchmark, but the standard verification and recording paths do not produce it.
- A category requirement is meaningful only when declaration, recording, candidate freshness, and gate matching are coherent end to end.
- Benchmark identity may need more than a free-text summary, but arbitrary benchmark quality or external result correctness must not be claimed beyond what APK can validate.

## Invariants

- Benchmark policy cannot be made satisfiable by weakening required-category, result, gate-eligibility, or freshness checks.
- A benchmark pass is bound to the exact task, baseline, candidate, worktree, and repository HEAD identity required by the existing evidence model.
- Evidence type remains semantically distinct from report, manual, live, automated-test, artifact, and generic evidence.
- A real benchmark result is required; deterministic command success alone cannot manufacture benchmark evidence.
- Stale, failed, unavailable, not-run, mixed-revision, or different-candidate benchmark evidence never passes the gate.
- Existing non-benchmark verification and policy behavior remains backward compatible.
- Task Markdown and existing append-only evidence remain canonical sources of truth; no hidden ownership or policy store is added.

## Required evidence

- A v0.4.6 reproducer showing Type: benchmark policy requires benchmark while the ordinary verification contract cannot declare or emit it.
- A deterministic end-to-end benchmark pass showing declaration, recording, typed evidence, current freshness, and gate satisfaction.
- Deterministic failures for benchmark fail, unavailable/not-run, stale subject, different candidate, and candidate mutation during recording or execution.
- A negative test proving report, manual, live, artifact, and automated-test evidence cannot satisfy benchmark policy by text or incidental metadata.
- CLI/API recording output and rendered policy/gate output that identify benchmark declaration and result without manual evidence-file edits.
- Regression output proving non-benchmark tasks retain their previous evidence and gate semantics.
- Typecheck, lint, focused tests, full tests, build, dist currency, and git diff checks for the committed candidate.

## Review questions

- Is there exactly one understandable path from benchmark declaration to typed gate-eligible evidence?
- Can a benchmark task still be accepted by policy while no supported workflow can produce the required category?
- Can any ordinary green test, report, manual reference, or artifact path be mistaken for a benchmark result?
- Are baseline, candidate, worktree, HEAD, and benchmark identity checks applied before gate eligibility?
- Do stale, unavailable, failed, not-run, or mixed-revision records fail closed without deleting useful history?
- Does the CLI expose the canonical path without requiring direct JSONL mutation?
- Did the implementation preserve non-benchmark behavior and avoid a second policy engine?

## Counterexample searches

- Type: benchmark with only a normal automated deterministic check.
- Type: benchmark with a benchmark declaration but no benchmark execution or external recording.
- A benchmark pass recorded for candidate A evaluated against candidate B.
- A benchmark pass recorded before the current baseline or HEAD changed.
- A report, manual, live, artifact, or automated-test record with summary text containing the word benchmark.
- A benchmark command that exits zero without producing a real benchmark result.
- Benchmark fail, unavailable, not-run, mixed-revision, malformed, and duplicate-check records.
- A legacy non-benchmark task with automated, report, live, manual, or artifact evidence after the change.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-task-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx --test src/core/tasks/task.test.ts"}`
- `{"id":"focused-cli-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx --test src/cli/cli.test.ts"}`
- `{"id":"full-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"verification-report","type":"automated","required":true,"environment":"static","profile":"report","command":"pnpm exec apk task policy 0146"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update docs/task-system.md with the canonical benchmark verification declaration, recording workflow, typed evidence semantics, freshness rules, and a complete benchmark task example.
- Update docs/cli-commands.md with the supported benchmark verification or recording command and its failure behavior.
- Update docs/architecture.md if the evidence-model boundary or provenance contract changes.
- Update docs/decisions.md with the selected single canonical benchmark semantics and rejected alternatives.
- Update docs/progress.md when the implementation task changes status.

## Notes

- Confirmed v0.4.6 defect: policy.ts requires evidence category benchmark for the benchmark tag/type, declaredEvidenceCategories only emits report, live, manual, ci, artifact, and evidence, while evidence.ts alone already permits type benchmark; the normal path is therefore unsatisfiable.
- Downstream provenance: translator-agent used Type: test plus manual report/evidence as a workaround instead of an honest Type: benchmark contract.
- This task is a bugfix contract, intentionally tagged bugfix rather than benchmark, so the corrective task itself remains gateable while repairing the benchmark policy path.
- Neighboring completed tasks 0058, 0059, 0061, 0062, and 0096 established the evidence, execution, policy, gate, and external-recording foundations; none defines a benchmark declaration or typed recording path, so this is not a duplicate.
- Keep every list element in this task file on one physical Markdown line until Task 0145 is implemented.
