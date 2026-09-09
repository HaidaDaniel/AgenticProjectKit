# Task System

The task system is the unit of execution for Agentic Project Kit.

Tasks use compact metadata so agents can coordinate without spending much context.

## Compact task layout

```md
# Task 0001 - Title

State: todo
Owner: none
Mode: mvp
Lane: implementation
Scope: api,docs
Risk: low
Parallel: true
Depends on: none
Tags: mvp,api

## Goal

## Context files

## Files allowed to edit

## Files forbidden to edit

## Steps

## Acceptance criteria

## Verification commands

## Documentation updates

## Notes
```

## States

- `todo` - ready to claim.
- `doing` - claimed by one registered agent.
- `review` - implementation done, waiting for review.
- `done` - verified and complete.
- `blocked` - waiting on a decision or dependency.
- `canceled` - no longer planned.

## Owner rules

- `Owner` is a compact registered agent id.
- `Owner: none` is allowed for `todo`, `blocked`, and `canceled`.
- `doing` and `review` require a registered owner.
- `claim`, `release`, `block`, `review`, `done`, and `cancel` require `--owner`.
- Task state changes are protected by transient `.tasks/.apk.lock`.

## Agent registry

Agents register before task work:

```bash
pnpm exec apk agent register --id codex-a --developer alice --platform codex --model gpt-5.5
```

Registry path:

```txt
.agentic/agents/<agent-id>.json
```

Run log path:

```txt
.agentic/runs/YYYY-MM-DD_<developer-id>_<agent-id>.jsonl
```

Run logs are compact JSONL events for later developer/platform/model analysis. They do not store prompts, stdout, stderr, diffs, absolute paths, or context lists.

Legacy `.agentic/agents.jsonl` and `.agentic/runs.jsonl` are migration inputs only and should not be committed.

## Task rules

- Use one task file per unit of work.
- Keep allowed files narrow.
- Keep forbidden files explicit.
- Include exact context files.
- Include concrete verification commands.
- Do not mark a task done until verification passes.
- Use `pnpm exec apk task verify <task-id>` to check changed files against allowed/forbidden files before review or done.
- Use `pnpm exec apk lint` for the read-only repository/task-contract lint surface before review or done.
- Update `docs/progress.md` when task status changes.
- Use `Lane`, `Scope`, `Tags`, and `Parallel` to split work across agents.

## Contract lint

`pnpm exec apk lint` is a read-only aggregate check for task graph, metadata, path/policy, ownership, and generated-instruction drift. It reports malformed task files, duplicate or invalid dependencies, path contradictions, policy conflicts, state/owner violations, and missing or stale generated files through check-only sync. Exact planned output paths remain valid, and free-form steps are not interpreted with NLP guesses. Human output is concise; `--json` emits stable machine-readable findings. The command does not write reports, task files, or generated instructions; structural and sync errors return exit code 1.

## Dependency graph rules

- Every `Depends on` id must reference an existing task file.
- Dependency edges must not contain cycles.
- Missing dependencies are reported as audit warnings.
- Cycles are reported as audit errors.
- A task with a higher-numbered dependency is valid when that dependency exists.
- Run `pnpm exec apk audit` to validate the dependency graph.

## Task creation

Use `pnpm exec apk task create` to generate new task files with validated metadata:

```bash
pnpm exec apk task create \
  --title "Add Feature" \
  --mode mvp \
  --lane implementation \
  --scope cli,docs \
  --risk low \
  --context "AGENTS.md,docs/task-system.md" \
  --allowed "src/api/index.ts,docs/progress.md" \
  --verification "pnpm test"
```

The command:

- Auto-selects the next numeric task id.
- Generates a slugged filename under the configured task directory.
- Uses the task lock while selecting ids and writing files.
- Defaults to `State: todo` and `Owner: none`.
- Requires `--scope` and `--allowed` to include at least one value.
- Validates the rendered task against the parser before writing.
- Validates the dependency graph including the new task.
- Rejects duplicate slugs, invalid metadata, missing dependencies, and cycles.

Task templates reduce repetitive flags for common work:

```bash
pnpm exec apk task create --template bugfix --title "Fix Parser" --scope cli --allowed src/cli/index.ts
```

Supported templates:

- `bugfix`
- `feature`
- `refactor`
- `docs`
- `audit`
- `test`
- `migration`
- `async-worker`
- `provider-integration`
- `deployment`
- `benchmark`
- `security`
- `release`

`--type` is the canonical typed-template flag; `--template` remains an equivalent alias. `provider` and `integration` resolve to `provider-integration`, while `async` resolves to `async-worker`. A typed template persists its canonical `Type` metadata and maps its domain to deterministic policy tags, even when explicit `--tags` overrides the default tag list.

Domain templates populate structured verification and, where useful, the optional correctness contract. Their guardrails cover the relevant failure and review surfaces: migrations include compatibility, integrity, rollback/recovery, and idempotency; async workers include retries, cancellation, bounded concurrency, shutdown, and partial commits; provider integrations include timeout, fallback, malformed responses, and capability mismatch; deployments and releases include live candidate checks; benchmarks include comparability and leakage; security includes fail-closed and secret-boundary checks. Generated Markdown remains editable after creation.

Templates provide default mode, lane, risk, tags, context, verification, steps, acceptance criteria, documentation updates, and notes. Explicit flags override template defaults. `--title`, `--scope`, and `--allowed` remain required.

## Verification contract

New tasks store verification checks in a `## Verification` section. Each check is one JSON object in a readable Markdown bullet:

```md
## Verification

- `{"id":"unit-tests","type":"automated","required":true,"environment":"ci","profile":"deterministic","command":"pnpm test","artifact":"reports/test.xml"}`
- `{"id":"release-smoke","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Check the deployed release.","evidence":"release URL"}`
```

Checks declare `type` (`automated` or `manual`), `required`, `environment` (`static`, `ci`, `local`, or `live`), and `profile` (`deterministic`, `integration`, `trusted`, or `report`). Automated checks require `command`; manual checks require `instruction`. `artifact` and `evidence` are optional requirements.

The legacy `## Verification commands` section remains valid and is normalized in memory to required automated checks with `environment: local` and `profile: deterministic`. Legacy task files are not migrated automatically. The compatible `verificationCommands` projection remains available to existing command execution until profile-aware verification is enabled.

Use structured verification directly from the API or through the CLI:

```bash
pnpm exec apk task create --title "Release smoke" --mode product --lane release --scope release --risk high --context AGENTS.md --allowed docs/release.md --verification-json '[{"id":"smoke","type":"manual","required":true,"environment":"live","profile":"trusted","instruction":"Check the deployed release.","evidence":"release URL"}]'
```

Malformed JSON or check metadata reports the check number and invalid field. Prompts include the full structured requirement and retain the flat command list for compatible workflows.

## Correctness contract

Tasks may add optional Markdown list sections for `Correctness assumptions`, `Invariants`, `Required evidence`, `Review questions`, and `Counterexample searches`. These fields describe claims an implementation and independent reviewer must inspect; they do not add mandatory ceremony to low-risk tasks by themselves.

The canonical parser and renderer preserve these fields, omit empty sections, and leave legacy task objects and round-trips unchanged when no correctness fields are present. Implementation and independent-review prompts include only populated groups under `Correctness requirements:`. The task-create CLI accepts the matching comma-separated flags:

```bash
pnpm exec apk task create --title "Harden worker" --scope worker --allowed src/worker.ts --assumptions "queue delivery is at-least-once" --invariants "duplicate jobs are idempotent" --required-evidence "retry test output" --review-questions "What happens after a process crash?" --counterexample-searches "replayed message during shutdown"
```

These requirements are descriptive review inputs. They reuse the existing evidence records and completion policy; `Required evidence` does not create a proof artifact unless a verification check or policy explicitly declares one.

## Evidence records

Verification, review, and dogfood results can be stored as append-only JSONL records in `.agentic/evidence.jsonl`. Records include task, agent, run, evidence type, result, timestamp, check/profile identity, and a subject containing:

- `taskId`, `baselineId`, `candidateId`, and `worktreeId`;
- `repository: git` plus `headSha` for repository-backed work; or `repository: none` with explicit equivalent identities.

Evidence results are `pass`, `changes_requested` (review only), `fail`, `pending`, `unavailable`, or `not-run`. `readTaskEvidence` filters by task ID, while `compareTaskEvidenceFreshness` classifies a record as `current`, `stale`, or `unknown` against a candidate subject. Mismatched candidates remain in history but cannot be treated as current. Commands and short references are bounded; large stdout/stderr is not stored.

Use `apk task evidence <task-id>` for a safe summary of records. The append-only store keeps repeated runs and failed evidence instead of overwriting history.

### Bounded dogfooding

`apk task dogfood start <task-id> --owner <agent-id> --tool <tool> --scenario <text>` requires a registered agent, claims a todo task when needed, writes a reproducible protocol prompt and session metadata under `.agentic/sessions/dogfood/<task-id>/<session-id>/`, and records the session/run identity in the existing run shards. APK does not launch a model or external service.

After the controlled session, `apk task dogfood result <task-id> --owner <agent-id> --session <session-id> --outcome <pass|fail>` appends one distinct `dogfood` evidence record. It stores scenario, tool and agent identity, task goal, start/end timestamps, bounded failures, retries, observations, discovered issues, and optional action/tool/context/duration/latency metrics. A completed session cannot be recorded again, so a failed session cannot be promoted to pass. The schema is vendor-neutral and supports comparison by agent/tool without making dogfood a required completion gate.

## Profile-aware verification

`apk task verify <task-id>` runs all eligible automated checks by default. Pass `--profile deterministic|integration|trusted|report` to select one profile; `--profile all` is equivalent to the default. Automated checks in `static`, `ci`, or `local` environments can run. Manual checks and `live` environment checks remain `unavailable`, while checks outside the selected profile remain `not-run`.

Each check produces a distinct `pass`, `fail`, `pending`, `unavailable`, or `not-run` result. Required non-pass checks fail verification; optional failures do not. A verification run records one run ID and subject identity for every check. If the candidate changes during execution, pass results are converted to mixed-revision failures.

Claiming a task records a baseline in `.agentic/task-baselines.jsonl`: HEAD when available, dirty-file fingerprints, task file, and workflow bookkeeping paths. Later scope verification compares committed, working-tree, new, deleted, and renamed paths against that baseline. Unchanged pre-claim dirty files are reported as `preExistingFiles` and excluded from violations; edits after claim are attributed to the task. Task/evidence/run/agent bookkeeping paths are excluded explicitly.

`verifyTask` exposes machine-readable attribution with `baselineId`, `attributedFiles`, `preExistingFiles`, `bookkeepingFiles`, and diagnostics. No-git or unavailable-HEAD work remains supported but reports limited attribution instead of claiming certainty.

## Effective task policy

`resolveTaskPolicy(task)` calculates completion requirements without changing task state. `pnpm exec apk task policy <task-id>` prints the same read-only result, including reasons, blockers, diagnostics, and legacy compatibility.

- Low risk requires at least one required automated verification check.
- Medium risk adds scope checking and a lightweight review requirement.
- High risk adds scope checking, independent review, and declared evidence categories. Missing categories are blocking until declared by structured verification checks (`profile: report`, `environment: live`, `type: manual`, `artifact`, or `evidence`).
- Classification tags add requirements: `migration`, `async`, `worker`, and `security` require independent review; `deployment` and `release` require live evidence; `benchmark` and `evaluation` require benchmark evidence; `provider` and `integration` require report evidence.

Tag rules are additive and can be extended through the resolver API. Contradictory rules and incompatible tags such as `no-review`, `no-verification`, or `local-only` produce actionable blockers. Legacy `## Verification commands` tasks remain readable and receive local deterministic automated defaults; high-risk legacy tasks still report missing evidence instead of silently passing. Policy resolution is preparatory—completion enforcement begins in the later gate task.

## Independent review

The existing `apk review <task-id> --owner <agent-id>` transition moves an implementation task to `review`. A separate reviewer can prepare a review prompt or append review evidence without changing lifecycle state:

```bash
pnpm exec apk review 0063 --reviewer codex-reviewer --prompt
pnpm exec apk review 0063 --reviewer codex-reviewer --result pass --implementation-run verify-123
pnpm exec apk review 0063 --reviewer codex-reviewer --result changes_requested --finding "Cover the rollback path."
```

Reviewers must be registered and cannot equal the implementation owner. Review records use a distinct `review-...` run ID, retain reviewer identity, optional implementation-run linkage, findings, and the same baseline/candidate/worktree subject used by verification. `listTaskReviews` and `assessTaskReviews` expose history and `current`/`stale`/`unknown` freshness; changing dirty implementation content makes earlier review PASS evidence stale. Review prompts name the evaluated HEAD and baseline-to-current changed paths and require inspection of acceptance criteria, assumptions, failure paths, scope, and counterexamples. They explicitly reject green tests alone as correctness proof.

## Completion gate

`pnpm exec apk task gate <task-id>` previews the evaluator used by `done`. It is read-only and reports the exact candidate subject, dependency status, required verification evidence, scope violations, policy blockers, and independent review status. `apk done` runs this evaluator under the task mutation lock and has no force bypass.

Completion accepts only current PASS evidence for the evaluated task/baseline/candidate/worktree. Missing, failed, pending, unavailable, not-run, stale, or different-candidate verification/review evidence blocks completion. A successful transition appends a `completion` evidence record containing the exact evidence ID set before writing `State: done`; persistence or candidate-mutation errors fail closed. Existing task readability is preserved, but legacy tasks still need current verification evidence and any policy-required review/evidence.

## Task provenance

`apk task provenance <task-id>` reconstructs a bounded end-to-end trace from the task file, claim baseline, existing run log, evidence records, and local Git state. The trace connects:

- implementation/reviewer/completion runs to registered agent, developer, platform, model, and run IDs;
- baseline HEAD, dirty-file attribution, bookkeeping exclusions, resulting commits, and changed paths;
- verification, review, dogfood, and completion evidence without retaining raw stdout/stderr;
- each evidence subject to its current `current`/`stale`/`unknown` freshness, decision-time freshness when selected by completion, and later superseding evidence IDs;
- the exact completion evidence set and candidate subject used by the gate.

Human output is the default. `apk task provenance <task-id> --json` returns the same bounded structure for automation. Missing Git commits, baseline HEAD, or run-log links are reported as explicit diagnostics; they do not discard non-code task history. Task lifecycle writes are bookkeeping and do not create a false implementation revision, while changed implementation files do.

## Workflow status

`apk status` retains the repository-level mode, task counts, next task, generated-instruction drift, and latest run, and adds one bounded line for every active task. Each line exposes state, owner, risk, effective policy summary, dependency readiness, required verification progress, scope result, review freshness, evidence current/total counts, gate status and the next action. Gate blockers come directly from `evaluateTaskCompletionGate`, so missing independent review and pending/unavailable live evidence use the same reasons as `apk task gate` and `done`.

`apk status --detail` expands each active task with policy classifications/categories, dependency lists, verification counters, scope counts, review reason, evidence freshness counts, bounded gate blockers, provenance baseline/candidate/worktree/run counts, and diagnostics. It does not include raw command output or full run logs. Todo tasks are evaluated with an empty implementation path set so unrelated worktree changes do not make an unclaimed task appear to have implementation scope violations.

## CLI work loop

`pnpm exec apk work <task-id> --owner <agent-id> --target <agent>` connects the existing task workflow:

- validates the owner is registered;
- claims a todo task or continues a task already doing under the same owner;
- renders the task prompt;
- optionally writes `.agentic/sessions/<task-id>/<run-id>/prompt.md` with `--write-session`;
- prints next commands for `pnpm exec apk task verify`, `pnpm exec apk review`, and `pnpm exec apk done`.

It does not launch external AI agents.

## Model-agnostic worker handoff

`src/core/work/contract.ts` defines the shared `apk-worker-v1` boundary for any coding harness. `createWorkerPackage` supplies task identity, selected context, constraints, acceptance and verification requirements, output/evidence expectations, role, and run provenance. The allowed roles are `implement`, `review`, `fix`, and `verify`; vendor or harness identity stays outside the role field.

`parseWorkerPackage`/`serializeWorkerPackage` and `parseWorkerResult`/`serializeWorkerResult` provide bounded JSON-compatible round trips. A worker result includes `taskId`, `role`, `runId`, `status`, optional `commitIds`, `diffId`, evidence references, review findings, provenance identities, and a reason. Failed or `changes_requested` results require a reason. The contract is core-only and has no Codex, OpenCode, Claude, or other vendor SDK dependency.

The work loop selects a role independently of the target; the independent-review command keeps reviewer ownership separate:

```bash
pnpm exec apk work 0072 --owner codex-a --target codex --role implement
pnpm exec apk review 0072 --reviewer review-a --prompt
```

Exporter templates add shared contract guidance to Codex and OpenCode outputs. Run identity and task provenance remain the APK workflow's responsibility, so implementation and independent review can use different harnesses without losing continuity.

## Task archiving

Completed tasks can be archived to reduce noise in the active task list.

```bash
pnpm exec apk task archive 0001
pnpm exec apk task archive --all
```

Archive rules:

- Only tasks in `done` state can be archived.
- Archived tasks are moved to `.tasks/archive/`.
- `pnpm exec apk tasks` default output shows only active top-level tasks (excludes archive).
- `pnpm exec apk tasks --all` includes both active and archived tasks.
- Dependency resolution treats archived done tasks as completed prerequisites.
- `pnpm exec apk next-task` considers archived done tasks when checking `Depends on`.
- `pnpm exec apk task deps` marks archived prerequisites and dependents with `(archived)` tag.
- `pnpm exec apk task create` includes archived tasks in the id sequence.
- Archived tasks cannot be overwritten; existing archive paths are refused.
