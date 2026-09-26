# Task 0160 - Explain APK core concepts and trust boundaries

State: done
Owner: codex-0160
Mode: product
Lane: documentation
Type: docs
Scope: concepts,evidence,trust,docs
Risk: low
Parallel: true
Depends on: 0151,0157
Tags: docs

## Goal

Explain APK’s core workflow concepts and trust boundaries in terms supported by current implementation.

## Context files

- AGENTS.md
- README.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/decisions.md
- docs/agent-exporters.md
- docs/task-system.md
- docs/engineering/testing-strategy.md

## Files allowed to edit

- docs/concepts.md
- docs/progress.md

## Files forbidden to edit

- README.md
- src/**
- dist/**
- .tasks/archive/**
- docs/releases/**
- docs/decisions.md

## Steps

1. Describe repository-local state, task contracts, context, verification evidence, gates, and generated instructions.
2. Explain what the human, APK CLI, harness, model, Git, and hosted CI each own.
3. Show a compact flow separating deterministic checks, semantic review, and release validation.
4. Mark future capabilities and link operational guides.

## Acceptance criteria

- The page explains task contract, context, candidate identity, verification, evidence freshness, review, provenance, completion gate, and worktree/resource boundaries.
- Each concept maps to current behavior or explicit target label.
- Trust boundaries say APK prepares/evaluates workflow state but does not own model runtime.
- Task evidence is distinguished from hosted CI and release evidence.
- The page avoids duplicating the CLI reference.

## Correctness assumptions

- Workflow can be summarized independently of provider-specific harness.
- Accepted architecture and source define responsibilities.

## Invariants

- Model output is not treated as trusted evidence without declared checks.
- Generated instructions are not represented as enforcement.

## Required evidence

- Source-linked review covers workflow stages and actor responsibilities.

## Review questions

- Can readers distinguish local checks from human, harness, and CI work?
- Are generated and source-of-truth files distinct?

## Counterexample searches

- Wording implies automatic model execution or guaranteed correctness.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- This provides shared vocabulary for quickstart and README. Keep it factual and provider-neutral.
