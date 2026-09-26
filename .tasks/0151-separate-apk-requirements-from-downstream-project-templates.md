# Task 0151 - Separate APK requirements from downstream project templates

State: done
Owner: codex-0151
Mode: product
Lane: documentation
Type: docs
Scope: product,requirements,templates,init,docs
Risk: medium
Parallel: false
Depends on: none
Tags: docs

## Goal

Write factual first-party APK product requirements while keeping the generic requirements document emitted into initialized repositories as a separate template.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/product/requirements.md
- src/core/init/index.ts
- src/core/init/init.test.ts
- docs/progress.md

## Files allowed to edit

- docs/product/requirements.md
- src/core/init/index.ts
- src/core/init/init.test.ts
- src/core/templates/minimal-docs/product-requirements.md.hbs
- docs/progress.md

## Files forbidden to edit

- docs/releases/**
- package.json
- pnpm-lock.yaml
- .agentic/**

## Steps

1. Inspect the currently blank requirements file, init output, renderer, and init tests to distinguish APK-owned truth from downstream starter content.
2. Write concise APK product requirements covering users, supported workflow, boundaries, and explicit non-goals using current source and accepted decisions.
3. Preserve generic editable starter content in the template source and update init tests to prove initialized repositories still receive it.
4. Update only links that become ambiguous after the separation.

## Acceptance criteria

- Requirements cover target users, primary jobs-to-be-done, greenfield, brownfield, and constrained-resource workflows, trust/correctness requirements, non-goals, compatibility, usability goals, OSS adoption goals, release-quality expectations, and non-fabricated success signals.
- The repository contains non-empty, source-backed APK requirements with an explicit product boundary and non-goals.
- Newly initialized projects still receive a generic requirements starter, not APK requirements.
- Focused init tests prove the two destinations and contents stay separate.
- No unrelated init behavior or project template content changes.

## Correctness assumptions

- First-party product requirements and downstream-generated requirements serve different readers.
- Current init behavior is the contract unless a focused test reveals otherwise.

## Invariants

- Initializing a downstream repository never presents APK-owned requirements as that project’s requirements.
- No unimplemented capability is claimed as current behavior.

## Required evidence

- A focused init test demonstrates separation and a source review maps claims to behavior or explicit constraints.

## Review questions

- Can users tell which file describes APK and which file is generated into their project?
- Do tests prove separation rather than mere file presence?

## Counterexample searches

- A fresh init still copies APK-specific prose.
- The first-party document claims an unimplemented feature.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- This establishes a reliable source of product truth. Limit source edits to init and template separation; keep the starter generic.
