# Decisions

This file records architecture and product decisions that affect the implementation.

## ADR-0001 - Repository-first source of truth

Status: accepted

Decision:

Project context, rules, and task definitions live in the repository rather than in chat history.

Reason:

Repository-stored context can be reviewed, versioned, and exported to multiple tools.

## ADR-0002 - Neutral policy with exporters

Status: accepted

Decision:

The core behavior is defined once and exported to tool-specific instruction files.

Reason:

This reduces duplication and prevents tool-specific instruction drift.

Implementation:

Task 0006 adds a neutral agent policy input and renders AGENTS, Codex, OpenCode, and Cursor instruction files from shared exporter templates.

## ADR-0003 - Task-driven execution

Status: accepted

Decision:

Work should be organized as small, atomic tasks with explicit context, allowed files, and verification commands.

Reason:

Smaller tasks are easier for agents to complete safely and easier for humans to review.

## ADR-0004 - CLI first, no UI in v0.1

Status: accepted

Decision:

The first implementation is a TypeScript CLI, not a web application.

Reason:

The highest-value early behavior is repository automation, not a UI layer.

## ADR-0005 - Handlebars templates

Status: accepted

Decision:

Use Handlebars for template rendering in the implementation.

Reason:

The templating problem is simple and predictable, and Handlebars is a lightweight fit for text generation.

Implementation:

Task 0004 adds Handlebars as the renderer dependency for reusable text templates.

## ADR-0006 - Caveman as default style

Status: accepted

Decision:

Use the `caveman` skill as the default output style for this repository when the active agent supports it.

Reason:

This keeps instructions compact, reduces filler, and matches the repo goal of explicit, task-driven agent work.

## ADR-0007 - Minimal CLI scaffold dependencies

Status: accepted

Decision:

Use `typescript`, `tsx`, and `@types/node` for the initial CLI scaffold.

Reason:

This combination gives a small TypeScript development loop with direct execution in local development and proper Node globals in type checking.

## ADR-0008 - Conservative adopt writes

Status: accepted

Decision:

`apk adopt` scans existing repositories and writes only missing kit, documentation, task, and exporter files.

Reason:

Adoption must preserve application code and avoid overwriting existing project instructions or docs.

## ADR-0009 - Structured verification with legacy projection

Status: accepted

Decision:

Store verification as compact typed checks in task Markdown, while retaining `verificationCommands` as a derived compatibility projection.

Reason:

Completion and verification workflows need explicit automated/manual type, requiredness, environment/profile, and evidence expectations without forcing existing v0.3.1 task files through a migration.

Implementation:

Canonical checks live as JSON bullets under `## Verification`. Legacy `## Verification commands` entries normalize to required automated checks with local/deterministic defaults. Structured checks are rendered in prompts; execution and evidence persistence remain later task capabilities.

## ADR-0010 - Dedicated append-only task evidence store

Status: accepted

Decision:

Persist task evidence in `.agentic/evidence.jsonl`, separate from agent/run analytics, with explicit task/candidate subject identity and freshness comparison.

Reason:

Verification, manual/live checks, reports, and review outcomes need preserved history, typed result states, and revision binding without placing large output or proof blobs in task Markdown.

Implementation:

Records require task, run, agent, evidence type, result, timestamp, baseline, candidate, worktree, and repository identity; Git subjects also require HEAD SHA. Missing or ambiguous identity returns `unknown` freshness, while mismatched candidate identity returns `stale`.

## ADR-0011 - Profile-aware verification is fail-safe

Status: accepted

Decision:

Verification executes only eligible automated checks for the requested profile and records every check outcome, including unavailable and not-run states.

Reason:

Manual/live requirements and skipped profiles must remain visible and must not become implicit passes. Candidate mutation during execution must invalidate pass evidence.

Implementation:

`apk task verify` keeps the legacy command projection, supports `--profile`, appends per-check evidence, and returns failure when any required check is not `pass`. Optional failures remain observable without blocking the run.

## ADR-0012 - Claim baseline for conservative scope attribution

Status: accepted

Decision:

Capture a task claim baseline in append-only `.agentic/task-baselines.jsonl` and compare later paths plus content fingerprints against it.

Reason:

A whole-worktree diff cannot distinguish pre-existing user edits from task changes. Safe verification must report attribution limits and avoid blaming unchanged dirty files or APK bookkeeping.

Implementation:

Git baselines record HEAD and dirty-file fingerprints; later verification includes post-claim commits and working-tree changes, handles new/deleted/renamed paths, and excludes unchanged baseline files plus explicit bookkeeping paths. No-git and detached/unborn HEAD states return diagnostics and fail closed on attribution certainty.

## ADR-0013 - Deterministic effective task policy

Status: accepted

Decision:

Resolve task completion requirements from the risk level and additive classification tags in a pure policy module. Keep policy output explicit and read-only until the completion gate composes it.

Reason:

Risk must produce predictable ceremony: automated verification for low risk, scope and review for medium risk, and evidence declarations for high risk. Classification-specific needs such as live release checks or independent security review should be extensible without an LLM or a large hardcoded classifier.

Implementation:

`resolveTaskPolicy` applies conservative defaults, merges the small built-in tag-rule registry with optional rules, deduplicates evidence categories, and reports conflicts or missing requirements as blockers. Only required checks declare gate evidence categories. A category declared exclusively by optional checks creates no requirement and never cancels an independent risk, type, or tag requirement, preserving `required: false` without weakening the tag registry; required categories remain fail-closed until declared by a required check. Legacy command-only tasks normalize to local deterministic checks; high-risk legacy tasks remain readable but fail policy resolution until evidence is declared. `apk task policy` is a read-only diagnostic surface; completion enforcement is deferred to the dependent gate task.

## ADR-0014 - Independent review uses separate revision-bound evidence

Status: accepted

Decision:

Keep the lifecycle transition to `review` separate from independent review certification. Record reviewer outcomes in the existing append-only evidence store with a distinct review run, reviewer identity, findings, and the evaluated candidate subject.

Reason:

An implementation owner must not certify a mandatory independent review. Review evidence must survive fix iterations, make stale PASS results visible after dirty changes, and give a later completion gate a stable current/stale/unknown assessment without requiring a vendor model runtime.

Implementation:

`recordTaskReview` validates a registered reviewer different from the task owner, emits `pass`, `changes_requested`, or `fail`, links an optional implementation run, and reuses verification subject/freshness semantics. `renderTaskReviewPrompt` names the baseline-to-current diff and requires acceptance, scope, hidden-assumption, failure-path, and counterexample review. The CLI supports `--prompt` and evidence recording; it does not change task state or enforce done.

## ADR-0016 - Optional correctness contract stays descriptive and sparse

Status: accepted

Decision:

Add optional task fields for correctness assumptions, invariants, required evidence references, review questions, and counterexample searches. Store them as compact Markdown list sections and propagate populated values to implementation and independent-review prompts.

Reason:

Reviewers need explicit claims and adversarial targets for high-risk, distributed, security, migration, benchmark, and architecture work, while ordinary tasks should not pay prompt or format noise for unused fields.

Implementation:

The task parser, renderer, creator, and CLI preserve these fields and omit empty sections. The fields guide inspection but do not independently alter verification or completion policy; required proof remains represented by structured verification and append-only evidence records.

## ADR-0017 - Typed templates are declarative task contracts

Status: accepted

Decision:

Extend the existing task-create template surface with canonical typed templates for feature, bugfix, refactor, migration, async-worker, provider-integration, deployment, benchmark, security, and release work, while retaining docs, audit, and test templates. Persist the canonical type in task metadata and map domain types to existing deterministic policy tags.

Reason:

Reusable domain guardrails reduce omissions in high-risk task contracts without introducing a second authoring system or requiring an LLM. Generated Markdown must remain compact, parseable, and editable.

Implementation:

Template defaults live in `src/core/templates/task-templates.ts`. They use existing structured verification and optional correctness fields; `--type` is canonical, `--template` remains an alias, and explicit flags override defaults. Provider/integration and async aliases normalize to canonical types. Policy consumes persisted type mappings in addition to explicit tags, so classification remains deterministic even when tags are overridden.

## ADR-0018 - Repository contract lint is a read-only aggregate

Status: accepted

Decision:

Expose `apk lint` as one deterministic, read-only result composed from task parsing, dependency validation, path/policy checks, state/owner checks, and check-only generated-instruction sync. Preserve malformed task diagnostics by loading raw active and archived Markdown instead of delegating only to the fail-fast task listing API.

Reason:

CI and agents need one stable surface for repository/task-contract drift without triggering audit report generation or mutating exports. Exact planned output paths must remain valid, and free-form task steps must not be interpreted with NLP guesses.

Implementation:

Human output is concise and findings are sorted deterministically; `--json` exposes the structured result. Structural and generated-file drift findings are errors with a non-zero exit code. Legacy policy evidence gaps remain warnings until the task declares the required evidence category. The implementation reuses existing validators and leaves room for a stricter release profile without adding a plugin engine.

## ADR-0019 - Budgeted context uses deterministic approximate units

Status: accepted

Decision:

Keep existing level-based context selection as the compatibility path. Add opt-in budgeted packs with required, relevant, and optional tiers; account for text as `ceil(UTF-8 bytes / 4)` units and preserve every required entry when the budget is too small.

Reason:

Agents need bounded prompts without network, embeddings, or model-specific tokenizers. A documented approximate unit is stable enough for local planning, while an explicit overflow diagnostic prevents silent loss of task contracts.

Implementation:

Core selection accepts deterministic available-file sizes plus changed, dependency, recent, allowed-path, and lexical signals. Repository-backed context/prompt commands load local files only. Budgeted selection exposes entries, units, reasons, and diagnostics; legacy calls without `--budget` retain their prior files and rendering. A later task may deepen dependency/change-aware ranking without changing this no-network contract.

## ADR-0020 - Context suggestions use bounded local dependency heuristics

Status: accepted

Decision:

Extend `suggest-context` with read-only Git change detection, a small relative-import scan for JavaScript/TypeScript, importer/dependent and related-test signals, task scope filtering, and explicit reasons. Keep lexical/path scoring as the fallback for unsupported languages and repository shapes.

Reason:

Affected implementation and tests should outrank unrelated documentation, but a compiler-grade multi-language graph would violate the repository-first lightweight scope. Scope filtering must distinguish context relevance from edit permission so forbidden paths cannot become implementation targets.

Implementation:

Candidates and signals are local, bounded, and sorted by score then path. Suggestions expose `role`, `score`, and `reason`; task-forbidden or disallowed paths may remain context-only. Git and import failures degrade to deterministic lexical/path ranking without network, model, embedding, or dependency changes.

## ADR-0021 - Dogfooding uses bounded vendor-neutral evidence

Status: accepted

Decision:

Represent controlled agent usability sessions as a distinct `dogfood` evidence type. Start creates a protocol-versioned prompt and session metadata, reuses registered agents and run shards, and result appends one immutable pass/fail record with bounded observations and optional metrics.

Reason:

Agent usability evidence must be comparable across tools without pretending to be automated test or benchmark proof. Append-only result identity preserves failures and prevents later commands from silently promoting a failed session to pass.

Implementation:

`apk task dogfood start` claims todo tasks when needed and writes `.agentic/sessions/dogfood/<task-id>/<session-id>/`. `apk task dogfood result` validates the session owner, timestamps, bounded lists, outcome, and optional action/tool/context/duration/latency metrics before appending `.agentic/evidence.jsonl`; it records the current task subject and a linked run event. APK performs no model or external-service execution, and dogfood remains available for future policy requirements without changing current completion gates.

## ADR-0022 - Provenance is a bounded read-only join over existing task records

Status: accepted

Decision:

Expose per-task provenance by joining task files, claim baselines, run shards, registered agents, append-only evidence, completion gate records, and local Git metadata. Keep the output bounded and provide human and JSON renderings; do not create a parallel telemetry or completion-policy store.

Reason:

An implementation history must explain ownership, harness identity, baseline, commits/diff, verification, review, stale/superseded revisions, and the exact completion decision without replaying raw logs. Missing Git or historical links must be explicit so non-code tasks remain queryable.

Implementation and invariant:

`src/core/tasks/provenance.ts` reconstructs the chain by task ID, synthesizes bounded run nodes when old evidence predates run linkage, and retains every evidence record with current freshness, decision-time freshness, and superseding IDs. Completion exposes its exact evidence set and candidate subject. Lifecycle-only task-file writes are excluded from the implementation candidate hash; only attributed implementation paths can supersede evidence. This invariant is covered by the multi-run provenance regression.

## ADR-0023 - Status is a concise projection of gate and provenance state

Status: accepted

Decision:

Extend the existing read-only `apk status` output with bounded active-task summaries and an opt-in `--detail` projection. Derive completion blockers from the shared gate evaluator and derive evidence/run/candidate counts from the provenance reader; do not duplicate policy rules or emit raw logs.

Reason:

Agents need one quick workflow view that explains what is ready, blocked, or actionable while preserving the detailed gate/provenance commands for investigation. The default must remain scannable even in repositories with many tasks.

Implementation:

Active tasks are capped at 32 and blockers/diagnostics at 8 per task. Todo tasks use an empty implementation path set when evaluating the gate so unrelated worktree changes do not appear as their scope violations. Default output is one compact line per active task; `--detail` adds bounded policy, dependency, verification, scope, review, evidence, gate, provenance and next-action fields. Status remains read-only and keeps existing doctor/audit responsibilities separate.

## ADR-0024 - Worker handoffs use a vendor-neutral package and result contract

Status: accepted

Decision:

Define `apk-worker-v1` in the core work module. Packages carry task/context/constraint/output expectations and one role (`implement`, `review`, `fix`, or `verify`); results carry task and run identity, status, optional commit/diff identities, evidence, review findings, reason, and provenance. Keep vendor and harness names in the surrounding workflow/exporter layer rather than the contract.

Reason:

Different coding harnesses must be able to implement, review, fix, or verify the same task without coupling the task model to an SDK or losing revision and run provenance. A bounded JSON-compatible contract is sufficient for local handoff and preserves existing prompt/export/sync behavior.

Implementation and invariant:

`src/core/work/contract.ts` validates and round-trips the shared package/result shape; `src/core/work/index.ts` creates a package for every work run; Codex and OpenCode templates publish the same guidance. Failed and `changes_requested` results require a reason, and no core module imports a vendor SDK. Role/result round-trip and generated-export drift tests cover the boundary.

## ADR-0025 - Gate evidence is bound, trusted, and fail-closed

Status: accepted

Decision:

Prepared review sessions persist an immutable candidate identity. Verification recaptures the complete baseline-aware path set after checks. Gate-eligible evidence must carry explicit trust status and a non-anonymous actor/run identity; Git comparison failures remain unknown rather than becoming empty diffs.

Reason:

A PASS is only useful if it proves the exact candidate that was reviewed or verified. Shared repositories, concurrent workers, and failed Git lookups otherwise allow mixed revisions or anonymous evidence to satisfy completion.

Implementation and invariant:

Review sessions live under `.agentic/reviews/`; stale result submission is rejected without rebasing. Evidence append uses a dedicated lock. Provenance labels broad commit history as repository activity and reports task-attributed paths separately. Glob lint proves overlap under the runtime path semantics before emitting a blocking contradiction.

## ADR-0026 - Issued worker packages are immutable and review-bound

Status: accepted

Decision:

Persist every issued worker package and metadata under `.agentic/sessions/work/<task>/<run>/`; accept results only when protocol, task, run, owner, role, and optional provenance match the issued record. Review worker runs reuse `prepareTaskReview` and `recordTaskReview` with the worker run as `reviewRunId`.

Reason:

Run-log events alone cannot prove what an external harness received. Rebinding a review PASS to a newer candidate or accepting a role-swapped result breaks the worker/candidate invariant.

Implementation:

`apk work --json` exposes the persisted package. Review packages carry the prepared review subject. Worker implement/fix/verify evidence is `gateEligible=false`; canonical check evidence and canonical prepared review evidence are the only worker-related completion proof. Result responses contain next role/action only; the next actor issues the next real package.

## ADR-0027 - Runtime evidence and same-worktree policy

Status: accepted

Decision:

`.agentic/evidence.jsonl`, `.agentic/task-baselines.jsonl`, `.agentic/evidence.append.lock`, `.agentic/reviews/`, and `.agentic/sessions/` are local runtime state and are ignored. Existing tracked JSONL state is untracked with `git rm --cached` without deleting local files. `Parallel: true` permits semantic parallelism, not concurrent mutable tasks in one working tree; separate Git worktrees/branches are required for safe attribution.

Reason:

Continuously mutating operational JSONL creates merge/concurrency hazards and can make two same-worktree tasks attribute each other's changes. Release evidence should be an intentional immutable artifact, not a live store commit.

Implementation:

Candidate/context bookkeeping excludes the evidence append lock and review/session paths. Issued worker metadata records a hashed worktree location and warns on detected unsettled runs in the same location. Unknown non-Git comparison remains diagnostic-only unless explicit candidate paths are supplied. Gate trust requires both explicit eligibility and a registered agent.

## ADR-0028 - Canonical worker progression and immutable session publication

Status: accepted

Decision:

Resolve omitted worker roles from the current canonical gate projection, not the latest orchestration record. A current failed review selects `fix`; missing, stale, or failed canonical verification selects `verify`; a missing current independent PASS selects `review`; otherwise no worker role is issued. Issuing an independent review package transitions `doing` to `review` only after all issuance preconditions and immutable package publication succeed.

Worker package provenance remains the issued/input candidate. Implement/fix/verify result submission recaptures the baseline-aware output candidate and stores it in non-gating lifecycle evidence; review results must match the issued prepared subject and canonical freshness check. Prepared reviews persist `origin=standalone` or `origin=worker`; only the latter requires an active worker session with exact task/run/package/reviewer binding. Issued sessions are built in a temporary directory and atomically renamed; review issuance confirms the candidate again after the `doing -> review` transition, then writes an activation marker last. Collision, incomplete, unactivated, or mixed-revision sessions cannot satisfy a result. Worker run IDs use one safe path-segment grammar across package/result/review parsing.

Reason:

The prior implementation selected roles from stale worker results, left `changes_requested` in `doing` while requiring `review` for `fix`, conflated mutable input/output candidates, and removed an existing run directory when a duplicate issuance hit `EEXIST`. These are one invariant family: workflow state, canonical gate state, and provenance must describe the same lifecycle.

Regression invariant:

Worker-origin `changes_requested -> fix` is executable without a hidden transition; current canonical evidence has priority over worker history; mutable runs preserve input A and output B; review B rejects mutation to C; an existing issued run remains byte-identical after collision; incomplete/unactivated sessions never accept results through either worker or standalone review APIs; provenance exposes each issued subject joined to activation/output status or a bounded orphan diagnostic; only activated unsettled mutable runs trigger same-worktree warnings; review issuance never advertises gate/done before a result.

Known P2 gaps from passing 0073 review remain release-blocking under Task 0080: duplicate result check is outside evidence-append critical section, failed worker review preparation can leave inert orphan, and standalone `changes_requested` while `doing` yields non-actionable fixer auto-role error.

## ADR-0029 - Explicit compatibility migration for gated workflow adoption

Status:

accepted

Decision:

Treat configs without an explicit schema marker, or with schema version 1, as legacy v0.3.1-style inputs. New `init` and applied adoption write schema version 2. `apk adopt --preview`/`--dry-run` builds a read-only exact change plan; `apk adopt --apply` explicitly applies only the config marker update and missing kit-file creates. Existing instructions, task Markdown, and unknown config keys are preserved. Legacy flat verification remains readable and is normalized in memory rather than mass-rewritten.

Reason:

The gated workflow adds policy, evidence, and structured verification requirements that should not surprise an existing repository or overwrite customized instructions. A visible plan plus explicit apply gives operators a reversible inspection point, while repeated apply must be safe.

Implementation and invariant:

`src/core/config/compatibility.ts` detects config and task-contract compatibility. Adoption reports legacy/gated/mixed counts and proposed changes. Future or invalid schema versions fail closed for migration. Preview performs no writes; apply is idempotent; old tasks remain parseable and existing files are never overwritten.

## ADR-0030 - Repository quality policy names capabilities, not tools

Status: accepted

Decision:

Define stable quality capability IDs for static analysis/typecheck, source lint, automated tests, build/package validation, coverage, local hooks and CI/clean-checkout validation. Detect bounded local evidence read-only; evaluate required versus recommended capability from optional repository policy. Keep tool/vendor names only in discovered evidence and executable command metadata.

AgenticProjectKit may choose concrete lint, coverage, hook and GitHub Actions tooling for its own repository. Adoption/init/templates never install or require those choices. One shared detection result supplies deterministic human/JSON output and projections for doctor/audit; later task verification may consume capability IDs without vendor matching.

Reason:

Repositories use different languages, package managers, linters, test runners, hook managers and CI providers. Global ESLint/Husky/GitHub assumptions would make adoption destructive and confuse capability with implementation. APK owns workflow/quality contracts and evidence, not target toolchain provisioning.

Proof boundaries:

- local hook: fast developer feedback; bypassable, non-authoritative;
- APK verify/gate: current task/candidate proof and policy enforcement;
- CI: clean-checkout reproducibility for checked-out SHA;
- release validation: frozen candidate proof combining required current evidence.

No layer substitutes for missing/stale evidence from another. Hosted CI status may remain separate exact-SHA release evidence; no GitHub API coupling or CI-platform abstraction required.

## ADR-0035 - APK-local guardrails stay separate from adopted-repository policy

Status: accepted

Decision:

Use ESLint with `typescript-eslint` for real TypeScript source lint, c8 for deterministic V8 coverage, and Husky with lint-staged for local hooks in AgenticProjectKit. Rename the repository's compiler-only `lint` behavior to `typecheck`; keep `lint` source-focused. `quality` composes typecheck, lint, and tests; `release:check` additionally runs coverage, build, and APK-specific sync/audit through the built CLI.
Declare Node.js `>=22.22.1` for this repository so the local ESLint/c8/Husky/lint-staged toolchain has an explicit supported runtime.

Measured baseline and thresholds:

- Baseline before guardrails: 267 deterministic tests; 91.72% lines/statements, 96.50% functions, 80.00% branches.
- Thresholds: 90% lines, 90% statements, 95% functions, 78% branches. Small headroom protects against regression without an arbitrary 100% target.
- Coverage output: ignored `coverage/coverage-summary.json` plus human-readable text.

Reason:

APK needs maintained local source-quality feedback while adopted repositories remain toolchain-neutral. Dev dependencies, hooks, and scripts are not installed, generated, or mandated by `init`, `adopt`, templates, or quality detection. Hook success is non-authoritative developer feedback; task verification, review, gate, CI, and release evidence remain separate.

## ADR-0036 - Clean-checkout CI proves repository reproducibility only

Status: accepted

Decision:

Use one GitHub Actions workflow for AgenticProjectKit pull requests and `main` pushes. Pin Node.js `22.22.1` and pnpm `10.28.1`, install with `pnpm install --frozen-lockfile`, bind the job to `GITHUB_SHA`, and run the 0078 quality/release scripts plus read-only `apk lint --json`/`apk sync` and report-writing `apk audit`. Run audit on the disposable CI checkout and fail on tracked or unexpected untracked drift.

After package build, self-repository CLI checks use `node dist/cli/index.js`; a clean root package must not depend on a self-linked or global `apk` binary.

Proof boundary:

- local hooks: developer feedback;
- APK verify/review/gate: candidate-bound task proof;
- CI: clean-checkout exact-SHA reproducibility;
- Task 0075: frozen release-candidate validation.

CI remains repository tooling, with no GitHub API coupling, credentials, publish, deployment, matrix, or adopted-repository workflow generation. Task 0075 may record hosted URL/status/SHA as separate evidence; CI success cannot satisfy another boundary.

Reason:

AgenticProjectKit needs one visible hosted reproducibility signal after local guardrails, while APK remains platform-neutral and target repositories remain unmodified by adoption.

## ADR-0031 - Local mutation locks use identity, not age, for recovery

Status: accepted

Decision:

Use one exclusive-file primitive for task lifecycle/create/archive and evidence append locks. Schema v1 binds a random owner id to PID, hostname, process-start identity, creation time, command, and optional task id. Publish complete metadata through a staged same-filesystem file plus atomic exclusive link. Recover automatically only when a same-host PID is confirmed absent; a responding PID must also match observed process-start identity, and TTL affects diagnostics only. Foreign-host, PID-reuse, unavailable-liveness, and malformed states fail closed behind explicit `apk task lock` inspection/recovery. Release and recovery use the same recovery guard and recheck owner identity before removal.

Operational lock reads retry transient Windows `EPERM`/`EBUSY` access contention within a fixed four-attempt bound. Exhausted or unknown read failures propagate; unreadable ownership never becomes absence.

Reason:

Age-only stale detection can steal a live long-running command, while unconditional cleanup can delete a successor lock. Identity-bound cleanup plus serialized dead-owner recovery preserves local mutual exclusion and removes routine manual `.apk.lock` deletion after crashes.

Non-goal:

This is a single-host filesystem contract, not distributed consensus or a network lock service.

## ADR-0032 - Primary agents may orchestrate required independent review

Status: accepted

Decision:

When task policy requires review, the primary agent may launch a separate read-only reviewer automatically, consume its revision-bound result, and continue `fix -> verify -> review -> done` without routine user confirmation. The reviewer must use a different registered agent identity and isolated review context from the implementation owner. Task 0081 depends on completed lock reliability work in 0076 because orchestration and review evidence share the local mutation/evidence paths.

Boundary:

APK prepares and validates review packages/evidence but does not own model runtime. Automatic delegation is an agent-orchestrator behavior and does not permit self-certification under another label.

## ADR-0033 - Worker review completion is one serialized lifecycle

Status: accepted

Decision:

Decide duplicate terminal worker/review results under the evidence append lock and append at most one result per run. Serialize worker review preparation cleanup and activation with a per-run lifecycle lock. Pre-activation failure removes only the exact worker-origin preparation; mismatched standalone/successor state and matching activated review sessions are preserved. Standalone findings do not mutate task state implicitly and instead emit the exact owner transition required before fixer work.

Reason:

Check-then-append admitted conflicting concurrent outcomes, while independently published review preparation could outlive failed issuance or be deleted after replacement. One append transaction plus identity-bound cleanup keeps evidence order, prepared subjects, activation and visible task history consistent.

## ADR-0034 - Execution profile is independent and assurance is resource-aware

Status: accepted; registry foundation implemented in Task 0083, remaining execution behavior planned in Tasks 0084-0088

Decision:

Keep project mode, task risk/assurance, and execution/resource profile as independent axes. Add vendor-neutral model, harness, and executable worker/resource definitions with capability, cost class, availability, and parallel capacity. Route each role to the lowest-cost eligible resource while preserving the minimum assurance required by risk, classification, change triggers, and the single completion gate.

Provide built-in `local`, `constrained`, `balanced`, and `abundant` profiles. Treat `constrained` as the primary reference: deterministic-first checks, local-first semantic work, trigger-based frontier escalation, and a baseline maximum of one frontier review pass. Normalize assurance as `none`, `self-check`, `fresh-context`, `independent`, and `diverse`; inability to satisfy a mandatory level is explicit and cannot silently become completion.

Configuration and lifecycle:

Extend the existing optional config schema for portable profile, secret-free declarations, budgets, calibrated recommendation, and separately preserved user overrides. Detection is deterministic and read-only by default. Semantic calibration is a bounded package through the existing worker/harness contract, executed externally, then deterministically validated before explicit apply. Existing evidence, review freshness, reviewer separation, task provenance, status, and gate records remain authoritative.

Reason:

A universal implement -> frontier review -> fix -> frontier review loop wastes scarce inference and makes one-subscription-plus-local-model deployments impractical. Capability must remain available without becoming mandatory execution. Resource-aware routing lets APK use local and deterministic lanes productively while reserving frontier quality for roles where it changes outcomes.

Boundaries:

APK does not own model runtime, provider SDKs, credentials, remote execution, billing, a cloud control plane, an always-on master LLM, or an autonomous/generic scheduler. Future attention and optional Git-worktree support are bounded projections/lifecycle helpers over the current task, run, worker, evidence, and provenance contracts.

Task 0083 implements the first bounded slice: optional `resources` config with distinct model, harness, and worker records; deterministic validation and introspection; secret-shaped field rejection; and optional `resourceId` binding in `apk-worker-v1` package/session provenance. It does not probe providers, persist credentials, select a route, or launch a runtime.

Task 0084 adds the deterministic routing slice without changing those boundaries. `executionProfile` is optional and independent from `defaultMode`; absent values resolve compatibly to `constrained`. Routing consumes existing task-policy requirements, filters validated resources by role/capability/availability/capacity, orders eligible candidates by profile and stable cost/ID rules, and reports deterministic `wait` or `needs-human` outcomes. Overrides are explicit explainable inputs and cannot bypass capacity or upstream policy.

Task 0085 adds ordered assurance levels and stable trigger IDs to the existing policy projection, including explicit `critical` risk and bounded review budgets. Medium remains compatible with the existing lightweight review field while its canonical minimum is `self-check`; high is `fresh-context`; critical is `independent` with diverse preference. The completion gate remains the only gate and reports exhausted loops instead of retrying indefinitely.

## ADR-0037 - Release reports are post-gate evidence artifacts

Status: accepted

Decision:

Freeze Task 0075 on a clean tracked HEAD. Treat ignored build/coverage/runtime records as non-candidate outputs. Append exact results to the two declared report files only after current verification, review, gate, and completion have selected the frozen subject. The following evidence-only commit is not the validated release candidate and must name the earlier SHA/tree/candidate IDs.

Reason:

A tracked report cannot contain its own commit SHA. Separating the validated candidate from its later evidence report avoids a self-referential commit and preserves honest freshness: any tracked mutation before gate still invalidates proof.

## ADR-0038 - Operator-recorded manual and live evidence is explicit and candidate-bound

Status: accepted

Decision:

`apk task verify --record` lets a registered owner append a typed gate-eligible result for a check declared `manual` or with `environment: live`, given an explicit bounded evidence reference. It captures the current baseline/candidate subject through the same path as executed verification, rejects automated checks, and requires a registered agent. Manual/live checks remain `unavailable` under normal `verify` execution.

Reason:

Required manual/live checks could not be satisfied by any supported surface while the design correctly refused implicit passes, so a release contract with a required hosted-observation check was unsatisfiable. Explicit operator recording preserves the no-implicit-pass and no-automated-laundering boundaries while allowing truthful externally-observed evidence to satisfy the existing freshness and completion gate.

Implementation and invariant:

`recordManualVerification` validates owner registration and task-owner match, `doing`/`review` state, the declared check, manual-or-live eligibility, a non-empty bounded reference, and pass/fail, then appends through the evidence append lock with the captured candidate subject. A check declares exactly the evidence category its verifier emits (`report` > `live` > `manual`), so a required `manual`+`live` check declares `live` and a single recorded observation satisfies both the required per-check pass and the `live` category. Automated checks, unregistered or non-owner agents, and missing references fail closed; the record flows through unchanged provenance and gate evaluation.

## ADR-0039 - APK is a repository-local semantic control plane, not an external runtime

Status: accepted

Decision:

APK remains a repository-local semantic workflow and control plane. An external terminal/process/session runtime (for example Herdr) is a separate product that owns the live operator environment. APK state is repository-local; there is no global APK project database, and one APK executable/package may serve many repositories. APK integrates with an external runtime only through the repository, file paths, and the existing vendor-neutral worker/package contract — never by embedding the runtime.

APK owns: tasks, dependencies, claim/ownership, scope, risk, execution profile, resources, routing, assurance, verification, review, evidence, provenance, gate, semantic attention, and safe Git worktree ownership/lifecycle.

An external runtime owns: PTY, terminal panes, persistent shells, detach/reattach, live process lifetime, remote-machine connectivity, SSH/session UI, and operator navigation.

APK must not implement: a terminal emulator, a tmux clone, a Herdr clone, an SSH manager, a global process supervisor, a global APK daemon, cloud coordination, or a generic swarm.

Reason:

Conflating the semantic workflow layer with the live terminal/process layer would couple APK to platform-specific PTY, session, and remote-transport concerns, duplicate mature external tooling, and create a global daemon/state that contradicts the repository-local, provenance-first design. Keeping the boundary explicit lets APK stay lightweight and deterministic while an external runtime provides persistence and remote operator ergonomics.

Implementation and invariant:

The boundary is documented in `docs/architecture.md` and `docs/execution-profiles.md`. Tasks 0087 and 0088 are constrained to semantic attention/status and safe Git worktree lifecycle respectively; neither may claim live process facts or implement PTY/SSH/multiplexer/process-supervisor/remote-scheduler behavior. Adoption by an external runtime is deferred to a documented future dogfood plan; no integration implementation task or dependency is added by this decision.

Supported operating model:

```text
Windows/macOS operator machine
        |
        v
Remote SSH / external runtime
        |
        v
persistent Ubuntu dev host
        |
        +--> repo A -> APK state A (repository-local)
        +--> repo B -> APK state B (repository-local)
        +--> repo C -> APK state C (repository-local)
```

APK state stays in each repository; the external runtime may open a repository or an APK-managed Git worktree path as a pane/workspace cwd.

## ADR-0040 - Canonical AGENTS.md export with thin harness adapters

Status: accepted

Decision:

`AGENTS.md` is the only full common-policy generated export. Codex, OpenCode, and Cursor read `AGENTS.md` directly (root and nested), so APK stops generating `.codex/instructions.md`, `.opencode/AGENTS.md`, and `.cursor/rules/*.mdc`. Claude Code does not read `AGENTS.md`; its `CLAUDE.md` is a thin `@AGENTS.md` import. Gemini CLI reads `GEMINI.md` and supports `@file.md` imports; its `GEMINI.md` is a thin `@./AGENTS.md` import. No filesystem symlinks are used.

`NeutralAgentPolicy` plus repository docs remain the internal source of truth; `AGENTS.md` is a generated rendering, not a handwritten policy source. Only `agents`, `claude`, and `gemini` are active exporters; `codex`, `opencode`, and `cursor` remain accepted export/sync targets that resolve to `AGENTS.md` for backward compatibility.

Legacy cleanup is conservative. `apk export --report-legacy` classifies obsolete files read-only; `apk export --cleanup-legacy` removes only files whose normalized content exactly matches the known legacy rendering. Any differing existing file is treated as customized and preserved. A filename alone is never proof.

Reason:

Generating a full second copy of common policy per harness multiplied drift and review surface. Current harnesses either consume `AGENTS.md` natively or offer a documented native import, so thin adapters preserve one source of truth without symlinks or duplication. Exact-content classification prevents accidental deletion of user-authored files.

Implementation and invariant:

`src/core/exporters/index.ts` holds the reduced registry, thin-adapter targets, compatibility aliases, and legacy classification/cleanup. `src/core/templates/exporters/agents.md.hbs` carries the full policy (including the worker contract); `claude.md.hbs` and `gemini.md.hbs` are thin imports. Init/adopt/export/sync/scanner/audit/lint derive from the same registry, so the canonical set cannot drift between surfaces.

## ADR-0041 - Task list sections accept bullet and numbered items

Status: accepted

Decision:

The shared task list parser accepts both `- ` bullet items and `N. ` numbered items for the same sections. Parsing normalizes either marker to a plain item; rendering emits bullet items. Only the `Steps` section keeps ordered-step semantics.

Reason:

Task contracts are authored in Markdown and sometimes use numbered acceptance criteria. The parser previously recognized only bullet markers, so numbered items were silently dropped when a claimed task was re-rendered, corrupting the execution contract.

Implementation and invariant:

`parseList` in `src/core/tasks/index.ts` filters and strips both markers. A round-trip regression parses numbered acceptance criteria, re-renders, and re-parses without losing item text. Steps remain parsed by the separate ordered parser.

## ADR-0042 - Resource detection is read-only and calibration is validated before explicit apply

Status: accepted

Decision:

Deterministic resource detection is read-only, bounded, secret-free, and vendor-neutral: `apk resources detect` merges declared resources, local harness markers, and the shared quality-capability detector, and reports a stable inventory fingerprint. Calibration emits a bounded `apk-calibration-v1` planner package for an external harness; the returned recommendation is advisory until `apk execution calibrate --recommendation` deterministically validates it, and it is written only on explicit `--apply`, updating only the generated `executionCalibration` field. User `resources`, `executionProfile`, `executionOverrides`, and `quality` remain distinct and are never rewritten. Saved calibration is stale when its inventory fingerprint changes.

Reason:

Detection must not read secrets, log in to providers, or mutate state, and an LLM planner must not silently reconfigure routing. Separating read-only detection, a recommendation, deterministic validation, and explicit apply preserves the human override boundary and the single completion gate.

Implementation and invariant:

`src/core/resources/detect.ts` performs local marker/quality detection only and reports occupancy, location, and sanitized endpoint references, omitting credential-shaped query/bearer/userinfo values. `src/core/execution/calibrate.ts` builds the package (including a deterministic strongest-planning-worker selection), validates protocol/profile/role/worker identity/free-capacity/role-capability/local-profile/assurance-level/budget and rejects secret-shaped values. Calibration assurance is advisory: the canonical task policy/gate clamps effective assurance, so calibration never imposes a global floor or lowers a low/medium policy. Apply reads the raw config once (failing closed on non-missing read/JSON errors) and merges only the `executionCalibration` key so user keys are preserved; identical effective calibration is idempotent and preserves `generatedAt`, while a real change records a new `generatedAt`. The config schema accepts an optional `executionCalibration` object. `apk execution explain` surfaces calibration provenance and staleness. No provider SDK, model runtime, secret manager, or remote executor is introduced.

## ADR-0043 - Worker attention is a semantic projection, not process monitoring

Status: accepted

Decision:

`apk attention` and `apk workers` are bounded projections over existing task, gate, review, policy, provenance, resource, and issued work-session records. `apk workers` resolves `ready`/`busy`/`unknown`/`unavailable` from declared availability/capacity/occupancy together with canonical `apk-worker-v1` sessions: an activated run for an open task is `busy` and binds the proven `taskId`/`runId`, an unactivated or orphaned run is `unknown` plus a bounded diagnostic, a malformed session identity is `unknown`, a completed/canceled task does not hold a slot, and a resource with no conflicting canonical run is `ready`. `apk attention` emits a deterministic priority-ordered queue with task, state, owner, reason, blockers, assurance, review budget, and next action. Neither polls processes nor claims live PID/token/terminal/SSH state; machine-readable output stays runtime-neutral.

Reason:

Attention must remain meaningful without an external runtime and must not fabricate live-process knowledge APK cannot prove. Reusing canonical status/gate/policy keeps one source of truth and avoids a second state store, daemon, or scheduler.

Implementation and invariant:

`src/core/status/attention.ts` builds both views from `summarizeStatus`, `resolveTaskPolicy`, and `listWorkerSessions`; `src/core/work/session.ts` enumerates issued sessions without requiring a full package round-trip so malformed/incomplete sessions become diagnostics rather than free capacity. `src/cli/commands/attention.ts` and `workers.ts` expose human/JSON output with bounded `capabilities`, effective/declared occupancy, `remainingSlots`, and a proven current task/run only when exactly one active session exists. An external runtime owns PTY, persistent shells, detach/reattach, process lifetime, remote connectivity, and operator navigation (ADR-0039).

## ADR-0044 - Isolated parallel workspaces are safe Git worktree lifecycle only

Status: accepted

Decision:

`apk workspaces` provides an optional, repository-local APK-owned Git worktree lifecycle for parallel top-level workers. A workspace record binds `taskId`, optional `runId`, optional `resourceId`, branch, normalized absolute worktree path, a hashed `worktreeId`/`repositoryId`, baseline and candidate revisions, and a random ownership `marker`; runtime records live under `.agentic/workspaces/` and worktrees default under the gitignored `.apk-worktrees/` area. The default single-worktree workflow is unchanged when no workspace is selected.

Reason:

Concurrent mutable tasks in one working tree break baseline attribution. Native Git worktrees isolate changes without a custom VCS, but destructive cleanup of a worktree is dangerous, so creation and removal must prove ownership before mutation. A global workspace database would contradict the repository-local, provenance-first design.

Implementation and invariant:

`src/core/workspaces/index.ts` resolves the real repository root and real (or nearest-existing) absolute target path, rejects repository-root targets, path escape, symlink/`..` tricks, non-segment names, existing paths, registered worktrees, and APK marker/record collisions before running `git worktree add -b`. It writes the ownership marker into the worktree's Git administrative directory (never the main repository) and the record into `.agentic/workspaces/`. `assessWorkspaceSafety` requires agreement between the record, marker (including `runId`/`resourceId`), Git worktree registration, registered branch (detached refused), contained real path, worktree identity/hash, repository identity, task/run binding, and a clean Git status; mismatch yields `foreign`/`unsafe`/`unknown`/`ambiguous` and refuses cleanup. `assessWorkspaceRun` reuses `listWorkerSessions` plus task state: an activated run is `active` only while its task is open, a done/canceled task makes it `terminal`, and an unreadable or malformed session fails closed to `unknown`. `removeWorkspace` is dry-run by default and requires `--apply`; it never deletes a repository root, user/foreign worktree, dirty or unmerged worktree, open active-run workspace, unknown lifecycle, path outside the allowed area, or malformed metadata, and removes stale metadata only when Git has no registration. `apk status` surfaces bounded non-safe workspace diagnostics and `apk task provenance` lists bounded workspace bindings without absolute paths. APK does not start a PTY, SSH, terminal multiplexer, process supervisor, scheduler, automatic merge, or remote executor; an external runtime may open an APK-managed worktree path as a cwd (ADR-0039).

## ADR-0045 - Current calibration participates in routing; task policy stays authoritative

Status: accepted

Decision:

`apk execution explain` merges configuration deterministically: built-in default profile -> authored `executionProfile` -> current validated calibration -> authored `executionOverrides` -> explicit CLI override -> canonical safety/policy validation. A calibration recommendation participates only when its saved `inventoryFingerprint` equals the freshly recomputed inventory fingerprint (`current`); a `stale` calibration is reported in explain output but never influences the effective profile or route. Calibration profile overrides the authored profile but not the CLI `--profile`; a calibration route target is used only when the named worker passes the same capability/availability/capacity/profile validation as any other candidate, otherwise the deterministic resolver is used and the rejection is reported. Calibration `assuranceMinimum` is a raise-only preference: effective assurance is `max(canonical task requirement, calibration preference)` using the existing ranking, so calibration can raise but never lower canonical policy. Calibration budgets remain informational; the canonical review budget and completion gate are never weakened.

Reason:

Prior to this decision, calibration was only saved and displayed, so the documented precedence was inaccurate and `--apply` had no effect on routing. Routing must reflect saved recommendations without letting an external planner weaken task policy, assurance, or the completion gate.

Implementation and invariant:

`src/core/execution/index.ts` exposes `resolveExecutionRoute` with `profileSource`, `routeSource`, and a bounded `ExecutionCalibrationInfluence`; `resolveAssurancePlan` clamps `assuranceFloor` upward against the canonical requirement and reports `canonicalRequired`/`calibrationPreference`. `src/cli/commands/execution.ts` computes calibration status from `detectResourceInventory`, ignores stale calibration, applies the precedence above, and emits effective sources plus the exact saved recommendation (`savedCalibration`). No provider SDK, model runtime, scheduler, daemon, remote executor, or AI-Herdr integration is introduced.

## ADR-0046 - Workspace provenance proves canonical run/resource binding and calibration sentinels execute

Status: accepted

Decision:

Workspace provenance is proven, not caller-asserted. `apk workspaces create --run` resolves the canonical `apk-worker-v1` session through a single shared `resolveCanonicalRunBinding` helper and refuses before any mutation when the session is missing, malformed, unreadable, belongs to another task, or (when `--resource` is supplied) names a different resource. `--resource` requires `--run` because a declared planned resource without a run cannot be re-validated later. Cleanup re-resolves the same binding and fails closed to `unknown` when the record's `resourceId` no longer equals the canonical session resource.

Calibration sentinels execute with explicit, bounded semantics. A current `wait` yields a calibration-sourced `wait`/`wait` route and a current `needs-human` yields `needs-human`/`manual`; both set `routeSource=calibration` and `routeApplied=true` and are outranked by an explicit CLI or authored override. A current `deterministic` sentinel applies only where canonical semantics already select the deterministic lane (mechanical `verification`, or `review` not required by policy); on any role that requires semantic work it is refused with `routeApplied=false` and the canonical resolver/policy decides, so calibration can never bypass required review or assurance. Stale calibration contributes nothing.

Reason:

Workspaces previously trusted a syntactically valid `runId` and an existing configured `resourceId` without proving the canonical session relationship, so a caller could bind a workspace to a run or resource it did not own, and cleanup could not detect later divergence. Calibration sentinels were accepted by the schema but silently downgraded to advisory, so the documented semantics did not match effective routing.

Implementation and invariant:

`src/core/work/session.ts` exposes `resolveCanonicalRunBinding` over the existing `listWorkerSessions` primitive with no second state store. `src/core/workspaces/index.ts` calls it before `git worktree add` and from `assessWorkspaceRun` during cleanup. `src/core/execution/index.ts` applies sentinel outcomes in `resolveExecutionRoute` after override precedence and never lowers canonical assurance; `renderExecutionRoute` reports the recommendation, status, and applied flag. No provider SDK, model runtime, scheduler, daemon, PTY, SSH, remote executor, or Herdr integration is introduced.

## ADR-0047 - Workspace create captures canonical resource identity and sentinels pause deterministic lanes

Status: accepted

Decision:

When a workspace is created with `--run`, the matched canonical session's own `resourceId` is persisted onto the workspace record and ownership marker even when `--resource` is omitted; an explicit `--resource` still requires an exact canonical match and a legacy resource-less session yields no resource binding (nothing is invented). Cleanup keeps re-validating the persisted resource against the canonical session and fails closed on divergence.

Calibration `wait` and `needs-human` are conservative and apply to any otherwise-executable current-calibration lane, including canonically deterministic lanes such as mechanical verification, because they only prevent automatic execution. Canonical safety/policy (unavailable or budget-exhausted assurance) still returns first and is authoritative. The `deterministic` sentinel remains restricted to canonically deterministic lanes and is refused elsewhere. Route selection distinguishes hard and soft overrides: an explicit `resourceId` selection outranks calibration, while `preferLocation`/`preferCostClass` only affect resolver ordering and do not defeat `wait`/`needs-human`.

Reason:

Run-only workspace creation lost the proven canonical `resourceId`, leaving resource-level provenance unrecorded even though the session carried it. Separately, `deterministicRoute()` returned before sentinel handling, so a documented `wait`/`needs-human` recommendation on verification silently produced a deterministic route; the code and contract were inconsistent. Broad "authored executionOverrides outrank calibration" wording also overstated soft preferences.

Implementation and invariant:

`src/core/workspaces/index.ts` derives `effectiveResourceId = options.resourceId ?? binding.resourceId` and writes it to both the record and marker. `src/core/execution/index.ts` computes `deterministic` and canonical assurance first, then applies current-calibration `wait`/`needs-human` when no hard `resourceId` override is present, and only then returns the deterministic lane or selects a worker. `src/cli/commands/workspaces.ts` documents that `--resource` requires `--run` and `--run` captures canonical resource identity. No Herdr, PTY, SSH, provider SDK, scheduler, daemon, remote executor, or new resource architecture is introduced.

## ADR-0048 - Legacy review fields project from canonical assurance

Status: accepted

Decision:

`resolveTaskPolicy` derives the compatibility `independentReview`/`reviewLevel` fields from the final canonical assurance level instead of from risk directly. `none` and `self-check` require no independent semantic review; `fresh-context` requires a separate isolated reviewer projected as `lightweight`; `independent` and `diverse` require independent review. Assurance escalation triggers evaluate the effective policy tags (including type-derived tags), so `type: async-worker` earns the same `concurrency-async` escalation as an explicit `async` tag. Built-in tag rules contribute evidence categories only; a custom tag rule that sets `independentReview` or `reviewLevel` acts as a raise-only assurance floor and can never lower the canonical requirement. Calibration remains a raise-only preference and cannot create a semantic review lane for a task whose canonical assurance is `none`/`self-check`.

Reason:

Medium risk previously produced `independentReview: true` with `reviewLevel: lightweight` while canonical assurance said `self-check`. That competing projection made ordinary medium tasks enter a separate semantic-review lifecycle, blocked `apk done` on a review record, and could spend constrained scarce-frontier review capacity, contradicting the resource-aware design.

Implementation and invariant:

`src/core/tasks/policy.ts` exposes `reviewProjection` and `assuranceFloorForRule`; `assuranceTriggers` reads `policyTags(task)`. Gate, `apk done`, `apk work`, `apk status`, and `apk attention` keep consuming `requirements.independentReview` as the single review requirement, so they now agree with canonical assurance. No provider SDK, model runtime, scheduler, daemon, PTY, SSH, remote executor, or Herdr integration is introduced.
