# Task 0149 - Research and recommend a public project name

State: todo
Owner: none
Mode: discovery
Lane: research
Type: docs
Scope: naming,research,public-readiness
Risk: medium
Parallel: true
Depends on: none
Tags: research,naming,identity

## Goal

Produce a dated, evidence-backed name recommendation without renaming the repository or choosing for its human owner.

## Context files

- README.md
- package.json
- docs/project.md
- docs/decisions.md
- docs/agent-exporters.md
- docs/cli-commands.md
- docs/research/non-node-apk-installation-and-distribution.md

## Files allowed to edit

- .tasks/0149-research-and-recommend-a-public-project-name.md
- docs/research/project-name-research.md
- docs/progress.md

## Files forbidden to edit

- src/**
- dist/**
- package.json
- pnpm-lock.yaml
- .agentic/**
- docs/releases/**
- docs/decisions.md
- .tasks/archive/**

## Steps

1. Recheck the five candidates at execution time across GitHub repos and organizations, npm, PyPI, common CLI binaries, web search, .dev/.io/.com domains where checkable, obvious dev/AI products, and public trademark sources.
2. Record date, direct source links or reproducible queries, collision findings, unavailable checks, confidence limits, spelling/pronunciation, CLI, package, and repository ergonomics.
3. Compare PatchVerity, TaskVerity, DiffLedger, GateVerity, and ChangeVerity; discard material collisions and add a candidate only with a documented reason.
4. Recommend a candidate or no-go outcome for the human owner without selecting or applying a name.

## Acceptance criteria

- Every required availability surface has dated evidence or an explicit not-checkable result.
- The report contains a candidate-by-candidate collision and ergonomics matrix plus a recommendation or no-safe-choice result.
- Known bad directions are recorded: AgentLedger, RepoPact, Prooflane, ProofRail, PatchProof, GateProof, RepoAssure, TaskSeal, existing Agentic Project Kit collisions, and apk/apkit ambiguity.
- No legal-clearance claim is made.

## Correctness assumptions

- Name availability and active products change; execution-time research supersedes earlier notes.
- Public trademark search is only a basic collision screen, not legal clearance.

## Invariants

- No repository, package, domain, or CLI identity changes in this task.
- Silence is not human approval.

## Required evidence

- A dated source-backed report and candidate matrix are present.
- The recommendation states uncertainty and preserves a no-go outcome.

## Review questions

- Can material collision claims be traced to current sources?
- Are subjective preferences separated from availability evidence?
- Was a name selected without human choice?

## Counterexample searches

- A domain or registry is unavailable to check.
- A new active AI/dev product collides with a candidate.
- A long project name is available but its short CLI conflicts.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`
## Documentation updates

- Create docs/research/project-name-research.md and keep it as research, not an approval record.

## Notes

- Research only; no rebrand, package change, CLI change, domain registration, or implied consent. May run in a separate worktree; serialize shared research navigation.
