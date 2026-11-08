# Task 0270 - Add document-proposal CLI and explicit lifecycle transitions

State: todo
Owner: none
Mode: maintenance
Lane: implementation
Type: feature
Scope: proposals,cli,lifecycle,docs
Risk: medium
Parallel: false
Depends on: 0269
Tags: p2,proposals,cli,lifecycle

## Goal

Add a small predictable apk proposal CLI for add, list, show, validate, accept, reject, and supersede with JSON automation, operator-asserted reasons, revision-bound decisions, and no implicit task creation or canonical promotion.

## Context files

- AGENTS.md
- docs/task-system.md
- docs/decisions.md
- docs/proposals.md
- src/core/proposals/index.ts
- src/cli/commands/backlog.ts
- src/cli/command-registry.ts
- .tasks/0269-add-bounded-document-proposal-storage-schema-identity-and-validation.md

## Files allowed to edit

- src/core/proposals/index.ts
- src/core/proposals/proposals.test.ts
- src/cli/commands/proposal.ts
- src/cli/command-registry.ts
- src/cli/cli.test.ts
- docs/cli-commands.md
- docs/proposals.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit

- .tasks/**
- .agentic/**
- docs/releases/**
- package.json
- pnpm-lock.yaml
- .github/**
- src/core/tasks/**
- src/core/backlog/**
- src/core/config/**

## Steps

1. Add the proposal command family to the canonical command registry and help surface with add list show validate accept reject and supersede operations.
2. Implement add with title kind summary and optional sections; it writes one proposal and never runs git add commit or push and never creates a task.
3. Implement list show and validate as read-only bounded operations with human and JSON output and diagnostics for duplicate or malformed proposals.
4. Implement accept reject and supersede with required actor and reason and with an explicit expected proposal revision or an equivalent pre-write revision check; record every decision with timestamp actor reason and revision while preserving prior decisions.
5. Reject invalid transitions and stale revisions with machine-readable and human-readable errors; supersede requires an existing traceable successor proposal ID.
6. Add CLI and core tests for every transition and refusal; document the CLI and trust boundary in docs/proposals.md and docs/decisions.md; regenerate the CLI reference; update docs/progress.md; rebuild committed dist.

## Acceptance criteria

- apk proposal add list show validate accept reject and supersede exist and follow existing command registry conventions.
- add creates only a proposal and performs no git operation or task creation; list show and validate are read-only.
- Only proposed proposals can be accepted or rejected; supersede records a traceable successor and invalid transitions fail closed.
- accept reject and supersede require an explicit actor and reason and bind the decision to the verified current proposal revision.
- Prior decision history remains visible; JSON output and actionable errors are available for automation.
- No command creates a task or promotes content into canonical documentation automatically.

## Correctness assumptions

- Proposal status changes are explicit operator actions and a proposal is never automatically promoted or converted to a task.; A recorded acceptance is an operator assertion bound to a verified proposal revision and not cryptographic identity authentication.

## Invariants

- add creates only a proposal file and performs no git add commit or push.; list show and validate are read-only.; accept reject and supersede require an explicit actor and reason and preserve prior decision history.; Invalid or stale transitions fail closed without modifying the proposal.

## Required evidence

- CLI exit-code and JSON output for every lifecycle operation plus invalid transition and stale revision refusals.

## Review questions

- Can any command create a task or mutate task state implicitly?; Is every decision bound to the exact verified proposal revision?; Do list show and validate avoid writes and heavy task imports?

## Counterexample searches

- Search proposed to accepted
- proposed to rejected
- superseded with a successor
- rejected to accepted
- missing reason
- missing actor
- stale revision
- unknown id
- duplicate id
- and JSON output.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"proposal-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/test-source.mjs src/core/proposals/proposals.test.ts src/cli/cli.test.ts"}`
- `{"id":"docs-consistency","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:docs"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`

## Documentation updates

- Document the proposal CLI and decision trust model in docs/proposals.md and docs/decisions.md.
- Regenerate the CLI command reference in docs/cli-commands.md.
- Update docs/progress.md when task state changes.

## Notes

- No separate proposal review or gate lifecycle is introduced.
- Accepted does not mean implemented deployed or canonical.
