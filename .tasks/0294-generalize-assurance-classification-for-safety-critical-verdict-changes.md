# Task 0294 - Generalize assurance classification for safety-critical verdict changes

State: done
Owner: opencode-corrective-impl
Mode: maintenance
Lane: refactor
Type: security
Scope: policy,assurance,tasks,tests,docs
Risk: high
Parallel: false
Depends on: none
Tags: security,policy,assurance,diagnostics,containment,provenance,tests

## Goal

Raise independent assurance for changes that alter safety-critical verdicts including diagnostics containment authorization provenance and security decisions, without a special case for any single task.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- src/core/tasks/policy.ts
- src/core/tasks/task.test.ts
- .tasks/0288-report-missing-canonical-apk-ignore-entries-in-doctor.md

## Files allowed to edit

- src/core/tasks/policy.ts
- src/core/tasks/task.test.ts
- docs/task-system.md
- dist/**

## Files forbidden to edit

- .tasks/**
- .agentic/**
- src/core/exporters/**
- src/core/audit/**
- src/core/doctor/**
- src/core/status/**
- package.json
- pnpm-lock.yaml
- .github/**

## Steps

1. Confirm audit F-005: task 0288 resolved medium risk self-check with no independent review despite changing a safety diagnostic.
2. Add a general assurance trigger for a bounded set of safety-verdict tags and task types covering diagnostics that report safety, authorization, containment, provenance and security verdicts.
3. Ensure the trigger raises assurance consistently with existing canonical triggers and never lowers a requirement; keep custom rules unable to weaken it.
4. Add policy tests across multiple distinct safety categories and a negative test showing ordinary documentation tasks are unaffected.
5. Verify no rule references a specific task id, title or historical task number.
6. Run focused checks, commit the candidate, then run canonical verification once.

## Acceptance criteria

- A task that changes a safety diagnostic or verdict receives at least fresh-context assurance and independent review even at medium risk.
- The rule is expressed in general tag or type terms and contains no task-specific special case.
- All covered categories are tested independently and a non-safety task keeps its prior policy.
- Existing canonical triggers and budget rules remain unchanged for unrelated tasks.
- Task policy output explains the new trigger reason.

## Correctness assumptions

- Safety verdicts require independent scrutiny regardless of numeric risk label

## Invariants

- Assurance requirements can only be raised by general policy not weakened by custom rules

## Required evidence

- Policy resolution results for each covered category

## Review questions

- Is any safety-verdict category left to self-check assurance

## Counterexample searches

- Ordinary docs task misclassified as safety; Security tag lowered by a custom rule; Task-specific special case sneaking into policy

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-regressions","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/tasks/task.test.ts"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","apkOperation":"lint"}`
- `{"id":"assurance-coverage","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Resolve policies for representative safety categories and ordinary tasks and record that review requirements follow the general rule."}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document general safety-verdict assurance rules in docs/task-system.md

## Notes

- Trust boundary: assurance classification must not depend on a reviewer remembering a past task
- Pre-existing untracked .tasks/0285 and docs/adoption-report.md are unrelated WIP and must not be touched
