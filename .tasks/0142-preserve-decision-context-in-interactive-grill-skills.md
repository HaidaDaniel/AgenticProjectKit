# Task 0142 - Preserve sufficient decision context in interactive grill skills regardless of agentStyle

State: todo
Owner: unassigned
Mode: product
Lane: skills
Type: corrective
Scope: grill,interaction,skills,agent-style
Risk: low
Parallel: true
Depends on: none
Tags: ux,grill,agent-style,corrective

## Goal

Make APK interactive grill skills reliably provide enough context for a human to answer each decision question, even when the active communication style is terse.

Preserve the intentional one-question-at-a-time interaction model. Do not turn grill into a questionnaire dump and do not globally disable concise styles. The correction is narrower: `agentStyle`, brevity guidance, or token-saving preferences must not remove the minimum decision context needed to understand why the current question is being asked.

## Context files

- AGENTS.md
- docs/task-system.md
- src/core/templates/skills/apk-project-grill/SKILL.md.hbs
- src/core/templates/skills/apk-task-grill/SKILL.md.hbs
- src/core/templates/**
- src/core/config/**
- tests covering skill rendering/generated instructions
- .tasks/0136-validate-and-supersede-canceled-0124-normal-default-behavior.md
- .tasks/0137-add-optional-project-level-grill-skill.md

## Problem

Downstream dogfood in `translator-agent` exposed a poor interaction mode:

- project grill correctly asks one question at a time;
- the project still had explicit legacy `agentStyle: caveman`;
- the grill instruction says to briefly state what the repository establishes, what remains ambiguous, and why the decision matters;
- the terse style compressed that framing too aggressively;
- the user received a question with too little explanatory context to comfortably make the decision.

The one-question loop itself is not the defect. The defect is that presentation style can erase decision-critical context.

## Required behavior

For each interactive grill question, the agent must provide enough human-facing framing to make the question independently understandable.

Before asking the single question, the response should communicate, in compact but normal prose:

1. what repository/project/task evidence already establishes that is relevant to this decision;
2. what ambiguity or unresolved branch remains;
3. why the distinction matters or what downstream behavior changes based on the answer;
4. then one clear question.

The exact sentence count is not a hard product contract, but the skill guidance should make clear that this normally requires more than a fragment. As a practical target, 2-5 concise sentences or equivalent framing is appropriate when the decision is non-trivial.

## Design constraints

- Keep one-question-at-a-time grill behavior.
- Do not dump a full questionnaire.
- Do not add mandatory extra model/reviewer passes.
- Do not globally remove `caveman` or other concise modes in this task.
- Do not make every question verbose when the answer is obvious from one line of context.
- Decision-critical context has priority over stylistic brevity.
- `agentStyle` controls presentation, not whether required decision context exists.
- Apply the same principle consistently to both project-level and task-level grill skills where applicable.
- If a communication-language preference exists, framing and question may use that resolved human language, but technical identifiers and repository facts remain exact.

## Implementation direction

Update the source skill templates and their tests so the contract explicitly separates:

- interaction cadence: one question at a time;
- decision context: required before the question when the decision is non-trivial;
- presentation style: may shorten wording but may not remove established fact + ambiguity + consequence framing.

Do not hard-code downstream `translator-agent` specifics into the generic skill.

## Acceptance criteria

- `apk-project-grill` still asks one question at a time.
- `apk-task-grill` follows equivalent context-preservation semantics where it conducts interactive clarification.
- Skill instructions explicitly state that terse/caveman style cannot suppress required decision context.
- For a non-trivial decision, generated guidance requires framing of established facts, unresolved ambiguity, and why the answer matters before the question.
- No requirement for a second model call, review pass, or separate summarizer is introduced.
- Existing optional/manual activation semantics of grill skills remain unchanged.
- Tests protect the new skill contract from regression.
- Generated `dist` artifacts remain synchronized according to repository policy.

## Correctness assumptions

- The human can answer better when the decision boundary and consequence are explicit.
- Conciseness is useful only after the minimum decision context has been preserved.
- One question at a time reduces cognitive load and should remain the default interaction shape.

## Invariants

- Grill remains optional/manual and never auto-activates merely because uncertainty exists.
- One-question-at-a-time remains intact.
- No mandatory multi-agent or multi-model workflow is added.
- `agentStyle` cannot override correctness-critical skill requirements.
- Technical evidence quoted from repository truth is not paraphrased into inaccurate claims for stylistic reasons.

## Required evidence

- Updated source skill template(s).
- Focused tests asserting the context-preservation contract exists in rendered skill output.
- A manual or fixture-based example showing a non-trivial grill question under `agentStyle: caveman` still includes understandable decision framing before the question.
- Confirmation that the skill asks only one question in that interaction step.

## Review questions

- Does the change fix insufficient context without making grill a long questionnaire?
- Can a terse style still shorten prose while preserving established fact, ambiguity, and consequence?
- Is the correction generic rather than tailored only to `translator-agent`?
- Are both project and task grill semantics consistent where relevant?
- Does the solution avoid additional model-cost requirements?

## Counterexample searches

- A grill response containing only a cryptic one-line question because `caveman` is active.
- A change that disables caveman globally instead of fixing grill requirements.
- A change that asks many unresolved questions in one turn.
- A new required review/model pass added merely to improve wording.
- Skill templates and committed/generated artifacts drifting out of sync.

## Verification

- `git diff --check`
- `pnpm test`
- `pnpm build`
- `node dist/cli/index.js lint --json`
- focused skill-rendering tests for project-grill and task-grill

## Documentation updates

Update only the skill/user-facing documentation needed to clarify that grill uses one-question cadence with sufficient decision framing. Avoid broad documentation churn.

## Notes

- This task is based on real downstream APK dogfood, not a speculative UX preference.
- Task 0141 may later provide a resolved human communication language, but this task must remain correct even without it.
- Backlog creation only; no requirement to alter project configs during planning.
