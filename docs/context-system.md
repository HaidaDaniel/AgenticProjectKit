# Context System

The context system tells an agent exactly which files to read before working on a task.

Default context output should be `caveman`-short unless the task needs detail.

## Budgeted packs

`apk context <task-id> --budget <units>` and `apk prompt <agent> --task <task-id> --budget <units>` build deterministic packs with approximate token units. A unit is `ceil(UTF-8 bytes / 4)` for files available in the repository; direct API callers can provide the same stable units through `fileSizes`. Missing explicit files use a deterministic path-length fallback.

Budgeted packs select tiers in order:

- `required`: agent instructions, level base contracts, active task, explicit task context, level-2 decisions, and available metadata-relevant design contracts;
- `relevant`: changed/dependency/recent files, files matching allowed task paths, and lexical task/path matches;
- `optional`: remaining available files, admitted only when budget remains.

Required files are never evicted. If their estimated units exceed budget, the result keeps them all and returns `required-over-budget` with exit code 1. Otherwise selected files stay within budget. Ordering, tier, reason, and units are exposed in the context selection; prompt rendering consumes the same representation. Operational lock, registry, run, evidence, baseline, and archived-task paths remain excluded. Legacy `--level` calls without `--budget` keep the existing selection and output.

## Context levels

### Level 1

Minimum context:

- `AGENTS.md`
- the current task file
- `docs/project.md`
- `docs/scope.md`
- `docs/architecture.md`

### Level 2

Add the relevant design docs:

- `docs/decisions.md`
- engineering docs related to the task;
- product docs related to the task;
- delivery docs related to the task.
- when scanner facts are available, use task `Mode`, `Lane`, `Scope`, and `Tags` to include only present matching docs.

### Level 3

Add source files and supporting repository files:

- likely affected modules;
- tests;
- configuration;
- migrations;
- generated files if relevant.
- excludes operational lock, registry, and run log files.

## Exclusions

The following operational files are not prompt context by default:

- `.tasks/.apk.lock`;
- `.tasks/archive/**`;
- `.agentic/agents.jsonl`;
- `.agentic/runs.jsonl`;
- `.agentic/evidence.jsonl`;
- `.agentic/agents/**`;
- `.agentic/runs/**`.

Agent registry, run logs, and archived tasks are analytics and history, not implementation context.

## Selection rules

- Prefer the smallest context set that still makes the task safe.
- Do not dump the entire repository into the prompt unless the task truly needs it.
- For local models, be stricter about exact file lists and allowed edits.
- For audit and adopt flows, include scanning and repository-shape documents first.
- Prefer task metadata (`Lane`, `Scope`, `Tags`, `Parallel`) over long planning prose when splitting parallel work.
- Keep evidence and run history out of implementation context; expose bounded evidence summaries through task/status commands when needed.
- Use scanner facts as availability bounds for metadata-driven docs.
- Budget signals may include explicit changed/dependency/recent paths; repository task dependencies are added deterministically by task id.
- Use `apk suggest-context "<task description>"` as optional local heuristic support when drafting a task. Suggestions are candidates, not guaranteed affected-file analysis.
- Independent review prompts use the task contract plus the evaluated HEAD, baseline, candidate/worktree identity, changed paths, acceptance criteria, and allowed/forbidden scope; they are inspection prompts, not implementation prompts.
- When present, review prompts also carry the task's correctness assumptions, invariants, required evidence references, review questions, and counterexample searches. Empty groups are omitted so low-risk or legacy tasks keep compact prompts.
