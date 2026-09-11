# Progress

## Current status

Phase 1 documentation is in place, Tasks 0001 through 0074, 0076-0078, 0080, 0081, the Resource-Aware Execution planning Task 0082, and follow-up Tasks 0089-0090 are complete. Tasks 0083-0085 now provide the registry, deterministic routing, and adaptive assurance foundation for Resource-Aware Execution.

The repository now has:

- project definition docs;
- scope and roadmap docs;
- architecture and mode docs;
- task system and context system docs;
- exporter and adoption docs;
- agent instruction files;
- initial task files.
- `caveman` documented as the default agent style.
- a minimal TypeScript CLI scaffold.
- an initial config schema with validation and defaults.
- config schema tests wired into `pnpm test`.
- an `apk init` command that creates starter kit files without overwriting existing files.
- init command tests wired into `pnpm test`.
- a Handlebars-based template renderer with file loading and strict data checks.
- template renderer tests wired into `pnpm test`.
- minimal project, scope, and architecture doc templates.
- minimal doc generation helpers covered by tests.
- neutral agent exporter templates for AGENTS, Codex, OpenCode, and Cursor.
- generated agent instruction files covered by drift tests.
- task file parsing and generation helpers.
- identity-bound local task/evidence locks with dead-owner recovery, fail-closed diagnostics, and explicit operator recovery.
- automatic primary-agent orchestration of separate revision-bound reviewers without routine user confirmation.
- atomic terminal worker/review result idempotence, exact failed-review preparation cleanup, and actionable standalone fixer transitions.
- an accepted Resource-Aware Execution architecture separating project mode, task risk/assurance, and execution profile.
- a constrained-first resource strategy with local/deterministic lanes, trigger-based frontier escalation, adaptive assurance levels, and bounded review budgets.
- six implementation-ready resource-aware contracts (0083-0088) covering registry, routing, assurance, calibration, attention status, and optional isolated workspaces.
- task format validation tests wired into `pnpm test`.
- an `apk context` command with deterministic Level 1, Level 2, and Level 3 file selection.
- context selection tests wired into `pnpm test`.
- an `apk adopt` command that scans existing repositories and creates missing kit docs without rewriting app code.
- adoption scanner and safe-write tests wired into `pnpm test`.
- README examples for the implemented CLI command surface.
- an `apk mode` command that reads and updates `.agentic/config.json`.
- mode command tests wired into `pnpm test`.
- an `apk next-task` command that selects the lowest-numbered todo task.
- next-task selection tests wired into `pnpm test`.
- an `apk export` command that writes all or selected generated agent instruction files.
- export command tests wired into `pnpm test`.
- an `apk prompt` command that generates concise agent prompts from task metadata and selected context.
- an `apk task create` command that generates validated task files with auto-selected IDs and dependency graph checks.
- task create command tests for success, invalid metadata, missing dependencies, duplicate slugs, and generated filenames.
- prompt command tests wired into `pnpm test`.
- README and CLI docs updated for the implemented v0.1 command surface.
- a read-only `apk lint` command for task graph, metadata, path/policy, ownership, and generated-instruction drift with stable human and JSON output.
- budgeted context packs with required/relevant/optional tiers, deterministic approximate token units, and explicit required-overflow diagnostics.
- dependency/change-aware context suggestions with local Git/import/test signals, deterministic reasons, and forbidden-path edit filtering.
- bounded vendor-neutral dogfood sessions with reproducible prompts, immutable pass/fail evidence, bounded observations, and optional usability metrics.
- post-readiness fixes for init/adopt workflow validity, config-aware task lookup, command-specific help, safe exports, and package bin/build support.
- compact task metadata with `State`, `Owner`, `Lane`, `Scope`, `Parallel`, and `Tags`.
- registered agent workflow backed by `.agentic/agents/<agent-id>.json`.
- compact run analytics backed by `.agentic/runs/YYYY-MM-DD_<developer-id>_<agent-id>.jsonl`.
- task state commands for claim, release, block, review, done, and cancel.
- discovery planning docs for requirements, load profile, tech options, and risk register.
- all task files converted to the compact format.
- task 0023 owner metadata fixed so task listing is valid.
- enriched repository scanning for kit docs, generated agent exports, config, and task files.
- an `apk audit` command that writes `docs/audit-report.md` and `docs/project-map.md`.
- audit validation for config and task file errors.
- an `apk sync` command with check-only default behavior and `--write` updates for generated instruction files.
- v0.2 and v0.3 task backlog files 0024 through 0033.
- v0.2 and v0.3 docs now exclude UI, SaaS, cloud sync, database, auth, and issue tracker sync.
- metadata-aware context selection for product, engineering, delivery, audit, adopt, sync, and testing docs.
- mode-aware prompt guidance.
- richer adoption reports with pre-adoption doc and export gap summaries.
- CLI smoke tests for help, audit, and sync.
- team analytics dataset sharded for low-conflict commits.
- `apk agent migrate-logs` for legacy log conversion.
- `apk analytics summary` for developer, agent, platform, and model comparison.
- CLI smoke tests for log migration and analytics summaries.
- public repository readiness cleanup: MIT license, package metadata, committed config, non-conflicting `apkit` bin alias, and ignored sharded telemetry.
- Claude Code and Gemini CLI exporters backed by the shared neutral policy.
- an `apk task archive` command that moves done tasks to `.tasks/archive/`.
- archive support for dependency resolution, next-task selection, and task deps inspection.
- archived task exclusion from default `apk tasks` output and context system.
- tests for single archive, archive all, non-done refusal, dependency resolution with archived tasks, and CLI smoke tests.
- regression fixes for task workflow review findings: unknown-flag rejection in archive, archive-all positional-arg rejection, archive-collision refusal, archived-task visibility in tasks --all, archived-task audit dependency validation, archived-task deps inspection, --scope/--allowed enforcement in task create, and CLI error handling without stack traces.
- completed CLI-focused backlog tasks for product positioning, CLI contract gaps, task verification, status, doctor, repo-readiness audit, context suggestions, task templates, and a CLI-only work loop.
- an `apk work` command that claims or continues a task, renders the prompt, can write a session artifact, and points to verify/review/done commands.
- generated agent instructions and agent setup prompts that use `pnpm exec apk` for project-local task workflow commands.
- structured task verification checks with legacy command compatibility, typed environment/profile metadata, and prompt/CLI propagation.
- first-class append-only task evidence with explicit subject identity, freshness comparison, corruption diagnostics, and task-level readout.
- profile-aware verification execution with per-check pass/fail/unavailable/not-run evidence, profile selection, timeout handling, and mixed-revision fail-closed behavior.
- claim-baseline scope attribution with dirty-file fingerprints, post-claim Git change collection, bookkeeping exclusions, and no-git diagnostics.
- deterministic effective task policy resolution from risk, tags, structured verification, and legacy defaults, with read-only CLI diagnostics and actionable blockers.
- independent reviewer runs, review prompts, findings, append-only review evidence, self-review prevention, and revision freshness assessment.
- candidate-aware completion gate shared by preview and `done`, with dependency/scope/policy/evidence/review enforcement and completion provenance.
- optional correctness assumptions, invariants, evidence references, review questions, and counterexample searches propagated through task files, CLI creation, and implementation/review prompts.
- typed task templates for generic and domain work, with editable structured contracts, correctness guardrails, canonical type metadata, aliases, and deterministic policy mapping.
- bounded end-to-end task provenance joining agents, runs, baselines, commits/diff, revision-bound evidence, stale/superseded history, and exact completion evidence sets with human/JSON output.
- concise active-task status with effective policy, dependency readiness, verification/scope/review/evidence progress, shared gate blockers, provenance counts, and bounded next actions; `status --detail` adds diagnostics.
- a vendor-neutral `apk-worker-v1` package/result contract with implement/review/fix/verify roles, bounded evidence/provenance fields, work-loop integration, and Codex/OpenCode export guidance.
- immutable issued worker sessions under `.agentic/sessions/work/`, JSON package exposure, exact owner/task/run/role binding, canonical prepared review-worker integration, non-gating orchestration records, and canonical verification-before-review progression.
- fail-closed worker/gate trust, explicit non-Git candidate semantics, evidence-lock bookkeeping exclusions, stale/unknown status projections, and same-worktree diagnostics.
- Task 0073 corrective regressions cover canonical current-state role resolution, post-publication review activation confirmation, worker-vs-standalone review origin binding, worker-origin `changes_requested -> fix`, issued/input versus output candidate provenance, activation-aware `apk task provenance`, safe run IDs, collision-safe atomic session publication, inactive-session warning suppression, incomplete-session rejection, review pending-result rendering, and status `run fixer` projection. Three retained P2 gaps are contracted in 0080.
- Task 0074 contains explicit legacy/gated compatibility detection, read-only adoption preview, idempotent `--apply` migration, preserved custom config/instructions/tasks, v0.3.1 fixture regressions, and cross-platform line-ending-safe renderer assertions; lifecycle is `done`.

## Next step

Current task: 0094 - Do not promote optional checks into completion requirements (`doing`, owner `codex-corrective-0094`; semantic correction in progress: optional checks neither create nor cancel policy evidence requirements). Corrective Task 0093 is done; 0079 still needs a clean new baseline after 0094 closes the optional-evidence gate defect.

Planned pre-release chain: 0074 -> 0077 capability contract -> 0078 APK-local quality guardrails -> 0079 clean-checkout CI -> 0075 frozen release validation. Tasks 0076 lock recovery and 0080 Task 0073 P2 fixes must also finish before 0075. New tasks stay `todo` with `Owner: none`.

After the gated-workflow release foundation, Resource-Aware Execution proceeds through 0083 -> 0084 -> 0085. Then 0086 calibration (also consuming 0077) and 0087 attention/status proceed independently; 0088 optional isolated workspaces follows 0087. This later milestone does not add dependencies to 0075 or the independent 0077-0079 quality chain.

0074 dependency on completed 0073 was added after 0074 entered `doing`. Recorded owner/state/baseline were not reset. Historical start before 0073 terminal transition remains visible; final release validation must assess integrated candidate rather than treat retroactive edge as historical gate proof.

## Remaining task plan

- Tasks 0001 through 0073 are complete.
- Task 0062: Meaningful Done; review capability now precedes completion enforcement.
- Task 0074: done; safe gated-workflow adoption, now explicitly dependent on 0073. The unblock pass made renderer assertions line-ending independent and uses the direct repository CLI entrypoint for self-repository verification.
- Task 0076: lock recovery; no dependencies, required by final release 0075.
- Task 0080: bounded 0073 review-finding fixes; depends on 0073 and must serialize with 0076 where files overlap.
- Tasks 0064-0066: Independent Correctness (complete; 0066 provides a no-write graph/path/policy/export consistency gate).
- Tasks 0067-0071: Efficient Agent Workflow (0067-0071 complete).
- Task 0073: Harness Interoperability complete.
- Task 0077: done; vendor-neutral capability detection and explicit repository quality policy contracts.
- Task 0091: done; corrective pass for the three bounded Task 0077 quality detector review findings, linked to completed 0077 and preceding 0078.
- Task 0092: todo; implementation-ready consolidation of agent instruction exports around canonical `AGENTS.md`, independent of the active release and resource-aware branches.
- Task 0093: done; restored test closure restored six independent top-level CLI cases, with V16 AST regression protection and Node 22/full-suite proof.
- Task 0078: done; APK-local typecheck, lint, coverage, fast-quality, release-check and feedback-only hooks.
- Task 0079: APK-local tooling -> clean-checkout CI.
- Task 0075: final frozen-candidate release validation after 0074, 0076 and 0077-0080.
- Task 0082: Resource-Aware Execution architecture/backlog documentation complete.
- Task 0083: done; optional secret-free model/harness/worker registry, deterministic `apk resources` introspection, and validated worker-session resource provenance.
- Task 0084: done; independent execution profiles, policy-aware routing, stable explain output, overrides, and wait/needs-human outcomes.
- Task 0085: done; canonical assurance levels, escalation triggers, critical risk, and bounded review budget projection.
- Task 0077: done; shared read-only quality capability detection, optional explicit policy, and `quality detect` CLI projection. Canonical lint/test/build, CLI smoke, doctor, independent review, gate, and done evidence passed.
- Task 0086: high-priority deterministic resource detection and validated worker-contract calibration after 0085; also reuses 0077 quality-capability output.
- Tasks 0087-0088: later worker attention/status after 0085, then optional safe isolated Git workspaces; 0087 remains independent of 0086.
- Contracts extend existing task verify, templates, graph validation, context, sync and work loop.
- Task links and dependency graph: [delivery milestones](delivery/milestones.md#next-gated-workflow-release-planned).
- Task 0092 depends on completed exporter/sync, contract-lint, adoption-compatibility and generated-policy foundations (`0029`, `0040`, `0066`, `0074`, `0081`); it remains `todo`/unowned and does not block unrelated release work.

## Notes

- Task 0090 removed the remaining 0087 wording ambiguity: attention/status can proceed in parallel with calibration after both branches receive canonical assurance state from 0085; no dependency or runtime behavior changed.
- Resource-aware planning validation: all 90 task contracts parse; 0083-0088 are `todo`/unowned with no missing dependencies or cycles. Task 0089 corrected the graph so 0086 and 0087 consume canonical assurance from 0085 while remaining independent of each other, and made the 0084/0085 ownership boundary explicit. Repository contract lint exits successfully with 17 pre-existing legacy evidence-policy warnings; local links and `git diff --check` pass. No runtime/CLI feature, completed Task 0082 history, 0074 lifecycle, or 0075/0077-0079 dependency was changed.
- Quality-guardrail planning pass: 80 active tasks parse and round-trip; no duplicate IDs, missing dependencies or cycles. Context validation resolves 972 existing paths, 4 explicit prerequisite outputs and 3 valid glob references; all 24 milestone links resolve. `apk lint --json`, `apk tasks`, `apk status`, `apk task deps 0075` and `git diff --check` pass; lint retains only pre-existing legacy policy warnings. Tasks 0077-0080 remain `todo`/unowned; no feature implementation or task claim performed.
- 0074 lifecycle warning: recorded baseline predates 0073 terminal task-file commit and this planning pass. Current read-only status reports 8 out-of-scope paths: `.tasks/0073-*`, `.tasks/0075-*`, `.tasks/0077-*` through `.tasks/0080-*`, `docs/delivery/milestones.md`, and `docs/roadmap.md`. 0074 allowed scope, state, owner and baseline were not expanded/reset; owner must resolve attribution without treating retroactive dependency or planning commit as historical gate proof.
- Worker-contract verification passed with bounded role/result round trips, immutable issued package/metadata persistence, exact role/owner/run binding, canonical review-worker freshness checks, non-gating lifecycle records, Codex/OpenCode guidance, `pnpm lint`, focused worker/status regressions, and the full suite after final validation.

- Corrective-pass validation: 76 tasks parse; all 20 backlog tasks remain todo/unowned and round-trip. No missing dependencies, cycles, self-dependencies or duplicate IDs; 461 context references and milestone links resolve. Task/dependency docs agree on 0063 before 0062 and 0076 before final release 0075.
- Corrective-pass doctor/status and task deps checks passed; git diff --check clean. Doctor retains three existing warnings (typecheck script, .env.example, GitHub Actions); no claim, product implementation, report-writing audit, commit or push performed.
- Contract-lint verification passed with graph/path/policy/state-owner and stale-export regressions; lint JSON remains read-only and reports generated-file drift with exit code 1.
- Context-pack verification passed with deterministic budget selection, required-tier overflow diagnostics, prompt integration, and legacy level compatibility.
- Change-aware context suggestion verification passed with deterministic dependency/import/test/Git ranking, task-scope filtering, per-suggestion reasons, and fallback behavior for unsupported project shapes.
- Dogfood verification passed with bounded prompt/session/result lifecycle, vendor-neutral pass/fail evidence, optional usability metrics, duplicate-session rejection, and failure preservation.
- Provenance verification passed with bounded task/run/agent/baseline/commit/diff joins, exact completion evidence-set reconstruction, stale/superseded multi-run history, non-code diagnostics, human/JSON output, and lifecycle-only candidate hashing.
- Workflow-status verification passed with concise and detail renderings, ready/dependency-blocked next actions, shared gate blocker consistency, pending live/manual visibility, bounded provenance summaries, `pnpm test`, `pnpm lint`, and `pnpm build`.
- Initial backlog planning validation: 75 tasks parsed; 19 new todo/unowned contracts round-tripped; no duplicate IDs, missing dependencies or cycles. All 445 initial context references and milestone links resolved; direct dependencies matched milestone table.
- Read-only checks passed: task parser/dependency API (same validation used by audit), tasks --state todo, task deps 0075, status, sync and doctor. Doctor has no failures; existing warnings: no typecheck script, .env.example or GitHub Actions. Report-writing audit and implementation test suites not run during planning.
- `apk init` verification passed with `pnpm test`, `pnpm lint`, CLI help, and a temp-directory smoke test.
- Template renderer verification passed with `pnpm test` and `pnpm lint`.
- Minimal doc template verification passed with `pnpm test` and `pnpm lint`.
- Agent exporter verification passed with `pnpm test` and `pnpm lint`.
- Task system verification passed with `pnpm test` and `pnpm lint`.
- Context command verification passed with `pnpm test`, `pnpm lint`, and Level 2/3 CLI smoke tests.
- Adopt command verification passed with `pnpm test`, `pnpm lint`, CLI help, and a temp-repository smoke test.
- README examples verification passed with `pnpm test`.
- Mode command verification passed with `pnpm test`, `pnpm lint`, CLI help, and a temp-directory read/write smoke test.
- Next-task command verification passed with `pnpm test`, `pnpm lint`, CLI help, and live command smoke test.
- Export command verification passed with `pnpm test`, `pnpm lint`, CLI help, and a temp-directory single-target smoke test.
- Prompt command verification passed with `pnpm test`, `pnpm lint`, and `pnpm exec tsx src/cli/index.ts prompt codex --task 0014 --level 2`.
- v0.1 readiness verification passed with `pnpm test`, `pnpm lint`, and help checks for `init`, `adopt`, `mode`, `next-task`, `context`, `prompt`, and `export`.
- Post-readiness fix verification passed with `pnpm test`, `pnpm lint`, `pnpm build`, and fresh-repository smoke tests for `init`, `adopt`, `next-task`, `context`, `prompt`, and safe `export`.
- Compact agent workflow verification passed with task parsing, transition, registry, run log, lock, and compact prompt tests.
- Issue fixes verification passed: adopt creates task-system/context-system/decisions.md, init creates discovery docs, platform validation rejects unsupported platforms, and tech-stack.md matches package.json.
- Audit and sync implementation verification passed with `pnpm test` and `pnpm lint`.
- Final v0.2/v0.3 backlog verification passed with `pnpm test`, `pnpm lint`, and `pnpm build`.
- Team analytics verification passed with `pnpm test` and `pnpm lint`.
- Public readiness cleanup verification passed with clean `apk audit`, `pnpm lint`, `pnpm test`, `pnpm build`, and package dry-run checks.
- Claude/Gemini exporter verification passed with `pnpm lint`, `pnpm test`, `pnpm build`, `apk sync`, and `apk audit`.
- Task dependency inspection command verification passed with `pnpm lint`, `pnpm test`, `pnpm build`, and `apk task deps 0043` smoke test.
- Task create command verification passed with `pnpm lint`, `pnpm test`, `pnpm build`, and `apk task create --help` smoke test.
- Task archive command verification passed with `pnpm lint`, `pnpm test`, `pnpm exec tsx src/cli/index.ts task archive --help`, and `pnpm exec tsx src/cli/index.ts audit`.
- Task workflow review fixes verification passed with `pnpm lint`, `pnpm test`, `pnpm exec tsx src/cli/index.ts audit`, `pnpm exec tsx src/cli/index.ts tasks --all`, `pnpm exec tsx src/cli/index.ts task archive --help`, `pnpm exec tsx src/cli/index.ts task deps 0045`, and `pnpm exec tsx src/cli/index.ts task create --help`.
- Product positioning verification passed with `pnpm lint`, `pnpm test`, `node dist/cli/index.js audit`, and `node dist/cli/index.js sync`.
- CLI contract gap verification passed with `pnpm lint`, `pnpm test`, `pnpm build`, `node dist/cli/index.js task create --help`, `node dist/cli/index.js init --help`, `node dist/cli/index.js analytics summary --help`, and `node dist/cli/index.js audit`.
- Task verify command verification passed with `pnpm lint`, `pnpm test`, `pnpm build`, `node dist/cli/index.js task verify --help`, and `node dist/cli/index.js audit`.
- CLI status command verification passed with `pnpm lint`, `pnpm test`, `pnpm build`, `node dist/cli/index.js status`, `node dist/cli/index.js status --help`, and `node dist/cli/index.js audit`.
- Doctor command verification passed with `pnpm lint`, `pnpm test`, `pnpm build`, `node dist/cli/index.js doctor`, `node dist/cli/index.js doctor --help`, `node dist/cli/index.js status`, and `node dist/cli/index.js audit`.
- Repo-readiness audit verification passed with `pnpm lint`, `pnpm test`, `pnpm build`, `node dist/cli/index.js audit`, `node dist/cli/index.js status`, and `node dist/cli/index.js doctor`.
- Context suggestion verification passed with `pnpm lint`, `pnpm test`, `pnpm build`, `node dist/cli/index.js suggest-context "Add task status command"`, `node dist/cli/index.js suggest-context --help`, and `node dist/cli/index.js audit`.
- Task template verification passed with `pnpm lint`, `pnpm test`, `pnpm build`, `node dist/cli/index.js task create --help`, a temp `node dist/cli/index.js task create --template bugfix ...` smoke test, and `node dist/cli/index.js audit`.
- CLI work-loop verification passed with `pnpm lint`, `pnpm test`, `pnpm build`, `node dist/cli/index.js work --help`, `node dist/cli/index.js task verify --help`, `node dist/cli/index.js status`, `node dist/cli/index.js doctor`, `node dist/cli/index.js audit`, and a temp `node dist/cli/index.js work 0001 --owner codex-smoke --target codex --level 2` smoke test.
- Repo-local APK command verification passed with `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm exec apk sync`, `pnpm exec apk audit`, and `pnpm exec apk agent prompt --platform codex`.
- Risk/task-policy verification passed with `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm exec apk task create --help`, and `pnpm exec apk doctor`.
- Independent-review verification passed with `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm exec apk task create --help`, and `pnpm exec apk doctor`.
- Completion-gate verification passed with `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm exec apk task create --help`, and `pnpm exec apk doctor`.
- Correctness-contract verification passed with `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm exec apk task create --help`, and `pnpm exec apk doctor`.
- Typed-template verification passed with `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm exec apk task create --help`, and `pnpm exec apk doctor`.
