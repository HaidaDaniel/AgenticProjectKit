# Task 0121 - Document candidate and completion bookkeeping commit lifecycle

State: todo
Owner: none
Mode: maintenance
Lane: docs
Type: documentation
Scope: agent-policy,task-workflow,git,docs
Risk: low
Parallel: true
Depends on: none
Tags: documentation

## Goal

v0.4.3 canonical `AGENTS.md` correctly requires committing task-owned implementation/fix changes BEFORE final verify/review/gate so candidate-bound evidence references a committed candidate. But after the gate passes, `apk done` updates tracked task Markdown from `doing`/`review` to `done`, so the repository becomes dirty again after completion. A real downstream task produced a candidate implementation commit followed by a completion bookkeeping commit. This two-commit pattern is expected under the current tracked-task-state architecture.

Make this lifecycle explicit in canonical agent and user documentation. Do NOT promise `1 task = 1 Git commit` under the current tracked-task-state architecture. Document the lifecycle approximately as implementation/fix work -> candidate commit -> verify -> review -> gate -> `apk done` -> completion/bookkeeping commit if tracked task state changed.

Prefer distinguishing a candidate commit from a completion/lifecycle bookkeeping commit. Do not call the second commit another implementation commit. Do NOT suggest `apk done` followed by `git commit --amend` of the previous candidate, because amending changes the Git SHA and would invalidate candidate-bound evidence. Do NOT suggest rebasing or squashing before provenance/evidence concerns are resolved.

Audit `AGENTS.md`, the canonical neutral taskRules source, `docs/task-system.md`, the canonical development-workflow/testing docs, and `README.md` only if it documents workflow. If the generated `AGENTS.md` wording currently implies all task-owned changes must be permanently clean after `done`, clarify the bookkeeping distinction without weakening the requirement that implementation/fix changes are committed before final review/gate. You may record as a documented future design possibility the idea of an immutable tracked task contract plus untracked/runtime task lifecycle state, but do NOT create that architecture or another task in this scope, and do not turn this into a task-state storage redesign.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/architecture.md
- docs/decisions.md
- docs/engineering/testing-strategy.md
- docs/delivery/gated-workflow-release-evidence.md
- src/core/exporters/index.ts
- src/core/templates/exporters/agents.md.hbs
- src/core/templates/renderer.test.ts
- src/core/sync/sync.test.ts

## Files allowed to edit

- AGENTS.md
- src/core/exporters/index.ts
- docs/task-system.md
- docs/decisions.md
- docs/engineering/testing-strategy.md
- docs/delivery/gated-workflow-release-evidence.md
- docs/progress.md
- README.md
- src/core/templates/renderer.test.ts
- src/core/sync/sync.test.ts
- dist/**

## Files forbidden to edit

- src/core/tasks/**
- src/cli/**
- src/core/work/**
- src/core/resources/**
- .github/workflows/**

## Steps

1. Audit the canonical neutral `taskRules` source, generated `AGENTS.md`, `docs/task-system.md`, and canonical workflow/testing docs for the current commit-lifecycle wording.
2. Confirm how `AGENTS.md` is generated and synced before changing any generated text.
3. Document the candidate-commit then completion-bookkeeping-commit lifecycle and explicitly state that one task is not promised to be one commit.
4. Document that amend, rebase, or squash must not be used when it would invalidate candidate-bound provenance.
5. State the acceptance invariants without weakening the pre-review candidate-commit requirement.
6. If canonical generated `AGENTS.md` wording changes, regenerate it through the normal sync mechanism and update bounded renderer/sync regression tests.
7. Record the immutable-contract plus runtime-lifecycle-state idea only as a future design possibility, not as this task's implementation.
8. Run verification.

## Acceptance criteria

- Candidate implementation/fix work is documented as committed before final candidate-bound evidence.
- `apk done` may produce a tracked lifecycle-only change that is documented as normal.
- The lifecycle change, when tracked, is documented as committed separately.
- The resulting two-commit pattern is documented as normal.
- One-task-one-commit is not promised.
- Amend/squash is not recommended where it would invalidate provenance.
- The implementation commit SHA and the bookkeeping commit SHA can both be reported.
- Unrelated dirty state remains explicitly excluded from task commits.
- If canonical generated `AGENTS.md` text changes, it is regenerated through the normal sync mechanism and bounded regression tests are updated; if only docs change, no unnecessary implementation tests are invented.
- No task-state storage redesign is performed.

## Correctness assumptions

- `AGENTS.md` is generated from `DEFAULT_AGENT_POLICY.taskRules` in `src/core/exporters/index.ts` through `src/core/templates/exporters/agents.md.hbs`.
- `apk done` writes tracked task Markdown state and excluded runtime evidence/bookkeeping.
- Candidate identity is content-derived, so a pure commit before final evidence does not itself invalidate the candidate, while an amend that changes content/SHA can.

## Invariants

- Implementation/fix changes are still committed before final verify/review/gate.
- One task is not promised to be exactly one commit.
- Amend, rebase, and squash are not recommended when they would invalidate candidate-bound provenance.
- APK does not auto-commit, auto-amend, auto-squash, or rewrite history.
- Unrelated and pre-existing dirty state remains untouched and excluded.
- Generated exports remain canonical and drift-free.

## Required evidence

- Updated canonical documentation and, if generated `AGENTS.md` text changes, bounded renderer/sync regression output proving the canonical source and generated file stay consistent and drift-free.

## Review questions

- Does the documentation promise one task equals one commit?
- Does it recommend amend, rebase, or squash in a way that invalidates candidate-bound evidence?
- Is the bookkeeping commit clearly distinguished from the reviewed implementation candidate?
- If generated policy text changed, was it produced from the canonical neutral source rather than patched only in root `AGENTS.md`?

## Counterexample searches

- A task whose `apk done` only changes tracked task Markdown.
- A task with no task-owned changes.
- A handoff that reports only the implementation SHA and omits the bookkeeping SHA.
- Wording that implies the repository must already be clean before `apk done`.
- Amend suggestions that would change the candidate SHA.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"built-sync","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js sync"}`
- `{"id":"built-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js lint"}`

## Documentation updates

- AGENTS.md
- docs/task-system.md
- docs/engineering/testing-strategy.md
- docs/delivery/gated-workflow-release-evidence.md
- docs/decisions.md
- docs/progress.md

## Notes

- Non-goals: do not move task state out of Markdown, change `done` semantics, auto-commit, auto-amend, auto-squash, rewrite Git history, or force one commit per task.
- Risk may become medium only if implementation ends up changing generated canonical policy behavior rather than documentation wording.
