# Task 0142 - Preserve sufficient decision context in interactive grill skills regardless of agentStyle

State: done
Owner: code-owner-0142
Mode: product
Lane: skills
Type: corrective
Scope: grill,interaction,skills,agent-style
Risk: low
Parallel: true
Depends on: none
Tags: ux,grill,agent-style,corrective

## Goal

Make APK interactive grill skills reliably provide enough context for a human to answer each decision question even when the active communication style is terse.

Preserve the intentional one-question-at-a-time interaction model. Do not turn grill into a questionnaire dump, do not globally disable concise styles, and do not change the global `agentStyle` policy. The correction is skill-local: presentation style may compress wording but must not remove decision-critical context.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/exporters/index.ts
- src/core/templates/renderer.test.ts
- src/core/templates/skills/apk-project-grill/SKILL.md.hbs
- src/core/templates/skills/apk-task-grill/SKILL.md.hbs
- .tasks/0136-validate-and-supersede-canceled-0124-normal-default-behavior.md
- .tasks/0137-add-optional-project-level-grill-skill.md

## Files allowed to edit

- src/core/templates/skills/apk-project-grill/SKILL.md.hbs
- src/core/templates/skills/apk-task-grill/SKILL.md.hbs
- src/core/templates/renderer.test.ts
- docs/**
- dist/**
- .tasks/0142-preserve-decision-context-in-interactive-grill-skills.md

## Files forbidden to edit

- src/core/exporters/index.ts
- src/core/config/**
- package.json
- pnpm-lock.yaml
- .agentic/**
- .tasks/0141-add-local-human-communication-language-preference.md
- .tasks/0143-warn-when-legacy-explicit-caveman-remains-configured.md

## Steps

1. Capture the current contract gap in focused tests: project grill says to state context only "briefly", task grill has similar framing, and existing renderer tests protect one-question cadence but not the minimum established-fact + ambiguity + consequence context.
2. Strengthen both grill skill templates so each non-trivial question is preceded by compact framing of what repository evidence establishes, what material ambiguity remains, and why the answer changes the decision/contract.
3. State explicitly that terse/caveman presentation may shorten wording but cannot suppress this required decision context. Keep 2-5 concise sentences or equivalent as practical guidance rather than a rigid sentence-count contract.
4. Preserve one-question-at-a-time cadence, manual-only activation, no-write-before-approval semantics, and the existing bounded context strategy.
5. Strengthen renderer tests to protect the new context-preservation semantics and to confirm both grill skills remain optional/manual and absent from always-active common policy.
6. Rebuild committed `dist` and run the declared deterministic checks.

## Acceptance criteria

- `apk-project-grill` still asks one question at a time.
- `apk-task-grill` follows equivalent context-preservation semantics when clarifying a task.
- For a non-trivial decision, both skills require framing of relevant established facts, unresolved ambiguity, and why the answer matters before the question.
- Skill instructions explicitly state that terse/caveman presentation cannot suppress required decision context.
- Concise style remains allowed; the task does not globally change or disable `agentStyle: caveman`.
- No second model call, reviewer pass, summarizer, provider requirement, or additional lifecycle state is introduced.
- Existing optional/manual activation and explicit-approval-before-write semantics remain unchanged.
- Tests protect the new contract and committed `dist` remains synchronized.
- The correction works independently of Task 0141; if a communication-language preference later exists, it may affect wording language but not the required context structure.

## Correctness assumptions

- The current one-question-at-a-time cadence is intentional and is not the defect.
- Concision is useful only after the minimum decision context has been preserved.
- Global style rules already require material reasons/limitations to survive compression; the missing protection is the grill-specific contract and regression coverage.

## Invariants

- Grill remains optional/manual and never auto-activates.
- One-question-at-a-time remains intact.
- No mandatory multi-agent or multi-model workflow is added.
- Global `agentStyle` behavior is not redesigned in this task.
- Decision-critical repository evidence is not removed merely to satisfy a terse presentation style.

## Required evidence

- Updated project-grill and task-grill source templates with explicit context-preservation wording.
- Focused renderer tests asserting established fact + ambiguity + consequence framing and one-question cadence.
- A fixture/manual example showing a non-trivial question under terse/caveman style remains understandable without becoming a questionnaire dump.
- Passing sync/build evidence for committed generated artifacts.

## Review questions

- Does the change fix insufficient context without making grill verbose by default?
- Can terse/caveman style still shorten prose while preserving established fact, ambiguity, and consequence?
- Are project and task grill semantics consistent where relevant?
- Did the implementation stay skill-local instead of changing global style policy?
- Did the solution avoid extra model cost and lifecycle ceremony?

## Counterexample searches

- A grill response contract that permits only a cryptic one-line question because caveman is active.
- A change to `src/core/exporters/index.ts` or config semantics that globally disables caveman.
- A change that asks many unresolved questions in one turn.
- A new mandatory reviewer/model pass added merely to improve wording.
- Grill templates and committed `dist` drifting out of sync.

## Verification

- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"sync-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js sync"}`

## Documentation updates

- Update only user-facing grill documentation if a separate document duplicates the interaction contract; otherwise the skill templates are the canonical behavioral documentation for this correction.

## Notes

- Origin: real downstream `translator-agent` dogfood with explicit persisted caveman style.
- Task 0136 already protects the global rule that compression must preserve material detail; this task adds the missing grill-specific contract and tests rather than reopening style policy.
