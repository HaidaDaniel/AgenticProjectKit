# Task 0047 - Tighten Product Positioning

State: done
Owner: codex-plan-47
Mode: product
Lane: documentation
Scope: docs,readme
Risk: low
Parallel: false
Depends on: none
Tags: positioning,docs,readme,scope

## Goal

Make public docs match the implemented CLI reality: Agentic Project Kit is a repository-first workflow CLI for structured AI-assisted development, not a full agent framework, SaaS, web UI, or autonomous lifecycle engine.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/decisions.md
- README.md
- docs/cli-commands.md
- docs/progress.md

## Files allowed to edit

- .tasks/0047-tighten-product-positioning.md
- README.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/cli-commands.md
- docs/progress.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- runtime dependencies
- source code
- generated exporter templates
- web UI files or web UI plans

## Steps

1. Replace overbroad README language such as "repository-based operating system" with "repository-first CLI" wording.
2. Replace "manage the whole project lifecycle" with "support lightweight lifecycle modes through repo docs, task metadata, and generated agent instructions".
3. Replace "task generation for AI agents" with "task contracts and prompt generation for AI coding agents".
4. Make `adopt` wording explicit that the scan is lightweight/shallow unless richer scanning is implemented later.
5. Make `audit` wording explicit that current audit checks kit/workflow readiness, not full application quality, security, production, or architecture readiness.
6. Make `context --level 3` docs match current behavior: it uses task-declared context and allowed files; it does not infer likely affected modules unless a later task adds suggestion logic.
7. Keep v0.2 and v0.3 non-goals clear: no web UI, SaaS, auth, database, cloud sync, or issue tracker sync.
8. Update README current status so it references the new 0047+ backlog instead of saying no actionable todo tasks remain.
9. Update `docs/progress.md` when this task changes state.

## Acceptance criteria

- README describes APK as a CLI workflow tool, not an operating system or autonomous agent framework.
- README and docs do not imply deep code understanding, source rewriting, agent execution, web UI, SaaS, or production-readiness gates exist today.
- `adopt` is described as a lightweight repository scan.
- `audit` is described as current kit/workflow readiness, with future repo-readiness improvements left to later tasks.
- `context --level 3` docs do not promise automatic affected-file discovery.
- The docs still preserve the product ambition and roadmap without overclaiming current behavior.

## Verification commands

- pnpm lint
- pnpm test
- node dist/cli/index.js audit
- node dist/cli/index.js sync

## Documentation updates

- Update README positioning, command descriptions, and current status.
- Update docs/project.md only if the project definition still overclaims.
- Update docs/scope.md only to reinforce CLI-first and no-web-UI scope.
- Update docs/architecture.md only if architecture wording implies non-existent engines.
- Update docs/cli-commands.md for exact current command behavior.
- Update docs/progress.md when task state changes.

## Notes

- Source analysis found the main product problem is promise drift: docs suggest a broader system than the code currently implements.
- The strongest implemented value is the markdown task contract, allowed/forbidden files, context levels, task state workflow, agent registry/run log, and instruction sync.
- Do not implement any feature in this task; this is docs-only honesty work.
