# Task 0145 - Preserve multiline task list items across parse-render round-trips

State: todo
Owner: none
Mode: maintenance
Lane: task-system
Type: bugfix
Scope: task-system,parser,round-trip,tests,docs
Risk: high
Parallel: false
Depends on: 0098
Tags: bugfix,task-system,parser,round-trip

## Goal

Make the canonical task Markdown parser and renderer preserve ordinary multiline Markdown list items across parse-render-writeTaskFile round-trips, without changing Steps semantics or silently discarding contract text.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- src/core/tasks/index.ts
- src/core/tasks/workflow.ts
- src/core/tasks/task.test.ts
- src/cli/cli.test.ts
- .tasks/0098-preserve-numbered-list-items-in-task-section-round-trips.md
- .tasks/0099-restore-task-0092-acceptance-criteria-after-parser-round-trip-loss.md
- .tasks/0057-structured-task-verification-contract-with-backward-compatibility.md

## Files allowed to edit

- src/core/tasks/index.ts
- src/core/tasks/task.test.ts
- src/cli/cli.test.ts
- docs/task-system.md
- docs/decisions.md
- docs/progress.md
- dist/**
- .tasks/0145-preserve-multiline-task-list-items-across-parse-render-round-trips.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- .agentic/config.json
- .github/**
- src/core/tasks/policy.ts
- src/core/tasks/evidence.ts
- src/core/tasks/gate.ts
- src/core/execution/**
- src/core/workspaces/**
- src/core/resources/**
- .tasks/archive/**

## Steps

1. Define and document the smallest supported Markdown list subset for prose-oriented shared-list sections, including indentation, blank lines, nested-list handling, and fenced or code-like content.
2. Replace line-dropping list parsing with deterministic continuation handling for supported prose items while preserving bullet and numbered item normalization and leaving parseSteps semantics unchanged.
3. For Context files, allowed and forbidden paths, and structured Verification entries, choose either an explicitly documented multiline representation or deterministic rejection before mutation; never silently drop, concatenate, or corrupt continuation text.
4. Add focused parser, renderer, structured-verification, path-list, and claim/writeTaskFile-style mutation regressions for each supported or rejected section family.
5. Run focused and full verification, rebuild committed dist, and update the canonical task-system decision and progress records only as appropriate for the implementation task.

## Acceptance criteria

- An indented continuation line in a supported prose-oriented section belongs to the preceding item and survives parse-render-parse with its semantic text intact.
- A multiline numbered item remains one item and numbered markers continue to be accepted as established by Task 0098.
- Multiline prose items round-trip in Acceptance criteria, Correctness assumptions, Invariants, Required evidence, Review questions, Counterexample searches, Notes, Documentation updates, and other prose-oriented sections using the shared parser.
- Context files, Files allowed to edit, Files forbidden to edit, and structured Verification entries either support a documented multiline representation or reject unsupported continuation text deterministically before mutation; malformed paths are never silently concatenated and structured JSON is never silently corrupted.
- Multiple consecutive multiline prose items remain separate items with deterministic ordering and no merged or dropped text.
- Blank-line behavior between list items is explicitly defined, tested, and deterministic.
- Single-line legacy bullets and numbered items retain their existing parse and render semantics.
- Steps continue to use their separate ordered parser and do not acquire shared-list continuation semantics accidentally.
- Fenced or code-like content inside a supported prose item cannot silently corrupt the task contract; unsupported forms are preserved safely or rejected with a bounded diagnostic.
- Structured verification JSON remains valid and semantically unchanged after render and mutation round-trips, or an unsupported multiline representation is rejected before mutation with a clear diagnostic.
- claim, state transitions, and other writeTaskFile paths preserve multiline contract content.
- A parse-render-parse round-trip preserves semantic content and rendered output is deterministic.
- No production behavior outside task Markdown parser and renderer correctness changes.

## Correctness assumptions

- Task Markdown is the canonical source of truth and mutation commands may re-render it through writeTaskFile.
- Task 0098 intentionally fixed numbered markers only; its numbered-item behavior must remain compatible.
- Existing task contracts may contain ordinary Markdown continuation lines even though current tests do not cover them comprehensively.
- The implementation may define a bounded Markdown subset, but every excluded form must be explicit and fail closed rather than be silently lost.

## Invariants

- Mutation commands never silently delete task contract text.
- Existing single-line task files remain readable and semantically stable.
- Numbered list support from Task 0098 remains intact.
- Steps remain ordered-step semantics and are not parsed through the shared list parser.
- Renderer output is deterministic and parse-render-parse is content-preserving for the supported subset.
- Structured verification checks remain valid JSON records with the same check identity and fields.
- The fix does not become a broad Markdown parser rewrite or change task policy semantics.

## Required evidence

- A failing old-behavior reproducer showing a continuation line lost by v0.4.6 parse-render-writeTaskFile behavior.
- Focused regression output covering multiline prose bullets, numbered items, Notes, Required evidence, consecutive items, blank lines, legacy items, Steps isolation, and machine/path/structured sections.
- A claim or state-transition-style round-trip regression proving mutation does not delete continuation text.
- Deterministic evidence for the chosen prose, path, structured, nested, fenced, and malformed continuation semantics, including explicit rejection where support is not provided.
- Typecheck, lint, focused tests, full tests, build, dist currency, and git diff checks for the committed candidate.

## Review questions

- Can any continuation line still disappear from a shared list section during parse or render?
- Can indentation, blank lines, nested markers, or fenced content cause two prose items to merge or one item to vanish?
- Do path-oriented sections reject or preserve unsupported continuation text without silently changing a path value?
- Does the implementation accidentally change Steps ordering or semantics?
- Does structured Verification either preserve its documented multiline form or reject it before mutation with no JSON loss?
- Can claim, release, state transition, or another writeTaskFile path reintroduce the loss?
- Is the supported Markdown subset documented precisely enough for future task authors?

## Counterexample searches

- A prose bullet item whose continuation is indented by two spaces, four spaces, or a tab.
- Two consecutive multiline prose bullets with a blank line between them.
- A numbered multiline item followed by a bullet item and another numbered item.
- A multiline Notes item containing a colon, backticks, JSON punctuation, or a URL.
- A Context, allowed-path, or forbidden-path item with a malformed continuation that could be mistaken for another path.
- A structured Verification JSON object split across physical lines inside a list item.
- A nested bullet, fenced code-like line, or malformed continuation that is not part of the supported subset.
- A legacy single-line task and a Task 0098 numbered-list task after claim-style re-rendering.
- A task state transition that reads and writes the task file after multiline content was added.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"focused-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec tsx --test src/core/tasks/task.test.ts"}`
- `{"id":"full-tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update docs/task-system.md with the supported multiline list subset, continuation and blank-line semantics, nested or fenced-content policy, and structured Verification guidance.
- Update docs/decisions.md with the deterministic parser and renderer decision and its fail-closed boundary.
- Update docs/progress.md when the implementation task changes status.

## Notes

- Confirmed v0.4.6 defect: src/core/tasks/index.ts parseList trims and filters physical lines to marker-bearing lines, so a continuation such as `validation and shared inputs.` is dropped during parse-render-writeTaskFile.
- Downstream provenance: translator-agent had to restore the Task 0048 contract after APK re-serialization removed continuation text.
- Task 0098 fixed only numbered markers; Task 0099 restored content already lost from Task 0092. This task is not a duplicate because it covers the remaining continuation-line loss for future and existing contracts.
- Keep every list element in this task file on one physical Markdown line until the parser fix is implemented; this contract is intentionally safe for the current parser.
