# Task 0126 - Research agent-driven APK upgrade workflow

State: done
Owner: user
Mode: discovery
Lane: research
Type: docs
Scope: upgrade-design,compatibility,adoption,docs
Risk: low
Parallel: true
Depends on: 0074,0092,0110,0111,0115,0116,0117,0118
Tags: docs,research,design

## Goal

Research and design the repository-specific APK upgrade workflow. Compare deterministic and agent-driven models before choosing an architecture. Produce a canonical, evidence-grounded design report and a recommendation on whether existing primitives plus a reusable upgrade skill/instruction suffice, whether small deterministic additions are needed, and whether any new CLI is justified. Do not implement apk upgrade or assume a command is necessary.

### Motivation and bounded downstream evidence

ResLedger task 0032 upgraded its project pin/lock from v0.4.2 to stable v0.4.3 (release tag commit 0d56d074e01163a5b184fb247a254e4ee719a625), regenerated APK-owned metadata, checked Go detection and workflow quality, preserved active task 0003 state/evidence, and kept product/runtime code unchanged. Candidate cb52eb3 and completion 75b40ba separate tooling migration from tracked lifecycle bookkeeping. Its progress records that a tooling commit during another active task later caused stale-baseline attribution difficulties; do not assume a clean lint/doctor means ongoing task candidate/evidence compatibility is proven or solve this by resetting history. This is a workflow boundary to research, not authorization to redesign baselines here.

Translator-agent remains pinned to v0.4.2 in its recorded progress. Its task 0026/direction audit preserves customized project truth, done contracts, and live runtime artifacts while repairing pending docs/contracts. Use it only as a bounded contrasting repository shape/customization example; do not upgrade or re-audit either downstream repository.

The working hypothesis is agent-driven migration: APK supplies deterministic primitives, release/migration metadata, and canonical instructions; an external agent handles repository-specific reasoning. Evaluate the hypothesis rather than selecting it by assumption.

### Research scope and alternatives

Compare A: monolithic deterministic apk upgrade; B: agent-driven skill/instruction using existing primitives; C: agent-driven workflow plus a few demonstrated missing deterministic primitives; D: generated migration plan/compatibility report; E: any simpler model supported by evidence. Assess responsibilities, customization safety, reproducibility, preview/approval semantics, active-task/evidence compatibility, failure/recovery, maintenance cost, portability, and need for new CLI surfaces. Describe unsupported cases and tradeoffs, not a universal migration guarantee.

Inspect the current architecture and release/corrective contracts within listed context. Cover current version detection and declared-versus-installed version mismatch; package pin/tag/SHA and lockfile provenance; config schema evolution; adopt --preview/--apply; sync check/write; doctor; lint; audit's actual report writes; generated neutral instructions/adapters; report/cleanup of legacy generated files; task/evidence/provenance compatibility; ignored versus tracked runtime state; release notes/decisions; customized downstream files; dirty worktrees and active tasks; rollback and partial failure. schemaVersion is not an APK package version, and adoption marker/file creation is not a general package upgrade or guaranteed semantic migration.

Determine what an agent lacks today for a safe bounded upgrade. Evaluate conceptual installation/version report, old-to-current compatibility report, migration metadata, machine-readable changed defaults/policies, generated-file ownership report, and post-upgrade verification bundle. These are examples to test against existing surfaces, not pre-approved commands. Map each needed capability to existing primitives first and justify only concrete gaps.

Refine the desired flow against real architecture: inspect -> plan -> human-visible bounded migration proposal when material choices/destructive changes exist -> apply reproducible dependency/version migration -> deterministic compatibility/adoption operations -> sync through canonical ownership -> doctor/lint/audit -> host-project quality checks -> final diff/provenance inspection. Show authorized write boundaries, operational/report artifacts, generated versus customized ownership, and what happens when a step fails. Distinguish tooling candidate commit and any completion bookkeeping from APK auto-commit.

### Required design boundaries

Repository customization and unknown config keys survive. Historical task contracts/evidence/provenance are preserved without rebinding stale evidence, baseline reset/reclaim laundering, or retroactive certification. Tooling migration does not opportunistically fix unrelated product code, change user preferences, stop live workers, or orchestrate a provider runtime. Generated files change only through canonical ownership; filename alone does not prove safe overwrite/deletion, and customized instructions may legitimately require an explicit proposal rather than blind sync --write. Ignored state may be missing on a clean checkout; tracked runtime needs a visible separate remediation decision, never automatic deletion/untracking.

Reproducible pins and installed package identity must be inspectable before and after. Dirty/unmerged worktrees, ongoing task candidates, custom policy conflicts, unknown/future config versions, package acquisition/build failures, and post-upgrade failures need explicit stop/defer/recovery semantics. User-visible plans precede material/destructive decisions where appropriate. Recovery preserves unrelated dirty files and history, describes verified versus unverified rollback limits, and never recommends auto-force, force-done, auto-amend, or fabricated human authorization.

### Deliverables and non-goals

Write docs/engineering/apk-upgrade-workflow.md with the alternatives comparison, source/evidence references, current capability/gap matrix, recommended architecture, responsibilities APK/agent/operator/host project, canonical proposed workflow, compatibility policy, failure/recovery matrix, and concrete implementation follow-up proposals. Explain whether a reusable instruction is enough, whether new CLI is justified, and what deterministic CLI must not attempt to own. Record an accepted architectural conclusion in docs/decisions.md only when warranted by the research outcome; preserve historical decisions.

Implementation follow-ups include goal, bounded scope, acceptance/evidence, dependencies, and overlap assessment. Present them as proposals in the report; creation belongs to the normal APK planning process after the conclusion and its applicable authorization, not automatic speculative backlog writes during research. Existing 0119-0125 and 0127 are separate contracts, not an invitation to implement them.

No upgrade command, migration engine, automatic dependency rewrite, executable upgrade skill, package/runtime change, auto-commit/auto-force, provider integration, daemon, orchestration, live downstream upgrade, or broad product/repository audit. Deterministic verification validates report presence/references and repository contracts, not universal migration safety or agent reasoning quality.

## Context files

- AGENTS.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/task-system.md
- docs/context-system.md
- docs/decisions.md
- docs/progress.md
- docs/adoption-flow.md
- docs/agent-exporters.md
- docs/cli-commands.md
- docs/execution-profiles.md
- docs/engineering/package-structure.md
- README.md
- package.json
- pnpm-lock.yaml
- .agentic/config.json
- .gitignore
- docs/releases/v0.4.2.md
- src/core/config/compatibility.ts
- src/core/config/schema.ts
- src/core/config/defaults.ts
- src/core/docs/adopt.ts
- src/core/sync/index.ts
- src/core/exporters/index.ts
- src/core/init/index.ts
- src/core/tasks/provenance.ts
- src/core/tasks/evidence.ts
- src/cli/commands/adopt.ts
- src/cli/commands/sync.ts
- src/cli/commands/export.ts
- src/cli/commands/doctor.ts
- src/cli/commands/audit.ts
- .tasks/0074-provide-safe-adoption-path-for-the-new-gated-task-workflow.md
- .tasks/0092-consolidate-agent-instruction-exports-around-canonical-agentsmd.md
- .tasks/0110-make-git-tag-distribution-self-contained-and-prepare-v042.md
- .tasks/0111-align-generated-workspace-ignoredocs-with-canonical-apk-workspaces-path.md
- .tasks/0115-distinguish-hosted-ci-evidence-from-local-runs-of-environment-ci-checks.md
- .tasks/0116-preserve-task-scope-attribution-across-release-and-reclaim.md
- .tasks/0117-enforce-successful-task-commit-hygiene.md
- .tasks/0118-release-v043-corrective-dogfood-fixes.md
- .tasks/0119-add-first-class-human-decisions-for-exhausted-review-budgets.md
- .tasks/0121-document-candidate-and-completion-bookkeeping-commit-lifecycle.md
- .tasks/0123-add-optional-manually-invoked-apk-task-grill-skill.md
- .tasks/0124-make-caveman-explicitly-user-opt-in-instead-of-an-automatic-default.md

## Files allowed to edit

- docs/engineering/apk-upgrade-workflow.md
- docs/decisions.md
- docs/progress.md

## Files forbidden to edit

- src/**
- dist/**
- scripts/**
- package.json
- pnpm-lock.yaml
- .agentic/**
- .tasks/**
- .gitignore
- AGENTS.md
- CLAUDE.md
- GEMINI.md
- .github/**

## Steps

1. Read listed architecture/compatibility/ownership and latest release/corrective context. Extract the recorded ResLedger 0032 upgrade and translator-agent customization boundaries without conducting a new general audit or changing either repository.
2. Map declared package version, installed CLI identity, pin/tag/SHA, lockfile, config schema, and release metadata separately. Document concrete supported detection paths and uncertainty for missing/ambiguous installations.
3. Build a source-backed capability/gap matrix for adoption preview/apply, sync, doctor/lint/audit, legacy ownership/cleanup, generated instructions, ignored/tracked runtime, task/evidence/provenance, and host quality checks. Distinguish read-only from report/config/generated-file writes.
4. Compare the five architecture alternatives against the required customization, reproducibility, compatibility, cost, portability, and recovery boundaries. Test each proposed new primitive against current surfaces before recommending it.
5. Design the inspect/plan/proposal/apply/compatibility/sync/verification/diff-provenance flow with explicit material-decision approval points, dirty-worktree/active-task handling, canonical generated ownership, and preservation of user preferences/product scope.
6. Specify a compatibility policy and failure/recovery matrix for unsupported schema, customized exports, missing ignored state, tracked runtime, acquisition/build interruption, changed defaults, active task candidate invalidation, and quality failures. Do not solve gaps by forced lifecycle changes or evidence rewrites.
7. Write the canonical report, evidence references, recommended responsibilities and CLI non-responsibilities, and bounded implementation follow-up proposals with dependencies/overlap checks. Record any warranted architecture decision; defer follow-up task creation to the normal post-conclusion planning process.
8. Commit only research-owned documentation, run declared deterministic documentation/contract checks, and finish the existing policy-driven task workflow. No package upgrade, runtime implementation, or full application test train is needed for these documentation edits.

## Acceptance criteria

- A canonical research/design report compares monolithic deterministic upgrade, agent-driven instructions with existing primitives, instructions plus justified small primitives, generated migration plan/compatibility report, and simpler viable alternatives; the recommendation follows evidence rather than a preselected CLI.
- The report cites current source/contracts/releases and bounded downstream evidence, separates observed behavior from hypotheses, and remains usable without sibling repositories or ignored private runtime artifacts.
- Version detection distinguishes declared and installed APK versions, project pin/tag/SHA and lockfile, package acquisition/distribution, and config schema. Missing or conflicting identity is explicit; no unpinned branch is treated as reproducible.
- A capability/gap matrix covers schema evolution, adopt preview/apply, sync, doctor, lint, audit, generated neutral instructions/adapters, legacy ownership/cleanup, task/evidence/provenance compatibility, ignored/tracked runtime, release notes/decisions, customized files, dirty worktrees, and rollback/failure semantics.
- Every recommended new deterministic surface is backed by a concrete unmet need and compared with existing primitives. Conceptual version/compatibility/migration/default-change/ownership/verification reports are evaluated without creating commands in advance.
- The recommended workflow includes bounded inspect/plan, human-visible proposal for material/destructive choices, reproducible pin/lock migration, applicable deterministic adoption/compatibility, canonical sync, doctor/lint/audit, host-project quality, and final diff/provenance inspection; actual write side effects are identified.
- Repository-specific customization, unknown keys, existing user style/resource preferences, generated-file ownership, and legacy customized instructions are preserved. Filename-based overwrite/deletion or unconditional sync --write is not presented as safe migration.
- Historical tasks/evidence/provenance remain intact. The design addresses active tasks, candidate/evidence freshness, and baseline attribution rather than claiming lint/doctor certifies application correctness or recommending baseline reset, reclaim laundering, historical rebinding, or automatic reopen.
- Dirty/pre-existing/unmerged changes and ongoing work have explicit continue/isolate/defer/stop boundaries. Ignored runtime absence is normal; already tracked runtime requires separately inspectable remediation, with no automatic deletion or index mutation.
- Failure/recovery policy covers acquisition/build failures, unsupported schemas, customization conflicts, partial migration, sync/verification failure, and rollback limits. Preserve reproducibility and unrelated changes; no auto-force, fabricated operator consent, auto-commit, auto-amend, or product repair.
- The result names recommended architecture/primitives, whether a reusable upgrade instruction suffices, whether any new CLI is justified, what CLI must not own, and a concrete migration compatibility policy with supported/unsupported paths.
- Concrete implementation follow-up proposals have bounded goals/scopes/acceptance/evidence/dependencies and explicit overlap boundaries with 0119-0125/0127. Their creation is deferred to the usual authorized planning process after research conclusion.
- Only the report and warranted canonical decision/progress documentation change; no apk upgrade, migration engine, executable skill, package/dependency rewriting, downstream upgrade, provider integration, daemon, runtime orchestration, or application code change is implemented.
- Deterministic checks verify report presence and structural repository consistency; recommendations and hypothetical recovery scenarios are not mislabeled as executed migration or arbitrary-agent safety proof.

## Correctness assumptions

- Upgrade is repository-specific tooling migration; config schemaVersion and package version are separate, and current adopt primitives do not own every release migration.
- Existing version/compatibility/ownership/quality primitives may already suffice; new command names and metadata formats remain conclusions to justify, not requirements.
- Generated and customized content can require different handling; unknown keys and old explicit preferences must survive absent authorized material decisions.
- Historical evidence can be preserved while becoming stale for a new candidate; safe upgrade cannot fabricate equivalent fresh evidence or automatically reset an active baseline.

## Invariants

- Research/design only; no runtime/CLI/package changes, executable upgrade asset, live downstream migration, automatic commit/force, or unrelated product fixes.
- Customization, user preferences, historical task/evidence/provenance, and unrelated dirty state remain intact.
- Current and target installation identity/pins are reproducible and inspectable; material/destructive migration decisions have a visible proposal and appropriate authorization boundary.
- APK supplies deterministic repository primitives; external agent/operator handles repository-specific reasoning and decisions without provider/runtime ownership in APK.

## Required evidence

- Source/contract/release-backed alternatives comparison and current capability/gap matrix in docs/engineering/apk-upgrade-workflow.md.
- Bounded before/after ResLedger 0032 upgrade summary and translator-agent customization contrast, including task/evidence and active-baseline limits; references must not require ignored runtime artifacts.
- Design scenario matrix for clean pinned upgrade, customized exports/preferences, dirty or active-task repository, unsupported schema, acquisition/partial failure, and post-upgrade quality failure; label proposed recovery versus observed execution.
- Documentation/reference inspection and deterministic report-presence/lint/sync/diff checks; no claims that these prove universal agent-driven upgrade safety.

## Review questions

- Does the recommendation demonstrate why existing instructions/primitives suffice or exactly which unmet need justifies any new deterministic surface?
- Are package version, installed identity, config schema, generated ownership, report writes, and active task candidate compatibility distinguished accurately?
- Can the proposed workflow overwrite customization/preferences, touch unrelated product code, or relabel historical evidence during a tooling migration?
- Are planned changes inspectable before material/destructive decisions, and does each partial-failure state have an honest reproducible recovery path?
- Are follow-ups concrete proposals under normal planning rather than implemented commands or speculative new backlog tasks?

## Counterexample searches

- Declared v0.4.3 pin with installed v0.4.2 CLI, a mutable Git tag/branch, missing lockfile, or config schemaVersion incorrectly reported as package version.
- Customized AGENTS.md or legacy exporter filename whose contents are user-authored; sync/cleanup recommendations silently erase customization.
- Legacy autogenerated caveman preference, explicit resource override, or unknown config key is rewritten as part of an otherwise mechanical upgrade.
- A tooling commit lands while another task is doing and invalidates baseline/candidate attribution; a clean lint/doctor is mistaken for preserved current evidence.
- Ignored operational state is absent on clean checkout while runtime records are already tracked elsewhere; ignore generation is mistaken for untracking or safe deletion.
- Dependency installation or sync fails halfway through an upgrade; rollback restores tooling but loses unrelated dirty changes or claims stale evidence is fresh.
- Optional application readiness finding is treated as permission to fix product code or add runtime dependencies during tooling migration.

## Verification

- `{"id":"research-report","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node --input-type=module -e \"import { readFile } from 'node:fs/promises'; const s=await readFile('docs/engineering/apk-upgrade-workflow.md','utf8'); if(!s.trim()) throw new Error('Missing upgrade research report');\""}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"sync-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk sync"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- docs/engineering/apk-upgrade-workflow.md
- docs/decisions.md
- docs/progress.md

## Notes

- Backlog contract only. Research execution may inspect listed implementation boundaries read-only; creating this backlog task must not start research implementation, upgrade a dependency, or run a general APK/downstream audit.
- Bounded evidence: resledger@cb52eb3 is the tooling upgrade candidate and resledger@75b40ba completes .tasks/0032-upgrade-agenticprojectkit-to-v043.md; resledger@0c4ce6c:docs/progress.md records the v0.4.2 -> v0.4.3 upgrade and its interaction with active task 0003. translator-agent@631be46:docs/direction-audit-20260913.md and @e59286a:docs/progress.md provide the customization/preserved-history contrast. Core summaries are embedded here; sibling checkouts and ignored artifacts are not required context.
- 0074 implemented bounded legacy-to-gated adoption; 0092 owns canonical exports/legacy classification; 0110/0118 delivered installable releases and 0111/0115-0117 preserve operational/evidence/baseline/commit boundaries. This task designs a cross-release repository workflow using them, not another adoption or release implementation.
- 0119 owns review-budget decisions, 0120 transition reasons, 0121 commit-lifecycle docs, 0122 readiness consistency, 0123 task-grill, 0124 style opt-in, 0125 non-Node distribution research, and 0127 completed-milestone semantic audit. Mention their boundaries/possible future migration implications without extending or implementing those contracts; none is a prerequisite for this research.
- No new CLI or dependency is pre-authorized. Follow-up contract creation remains a post-conclusion planning step; no task/evidence schema or second persistent source of truth is designed merely to orchestrate upgrades.
- Research outcome (2026-09-14): `docs/engineering/apk-upgrade-workflow.md` records the accepted architecture: repository-specific upgrades are agent-driven workflows composed from existing deterministic APK primitives. A reusable manual upgrade instruction/skill is the preferred first follow-up; no monolithic `apk upgrade` command is justified. A small read-only version/compatibility report is allowed only if further dogfood proves a concrete repeated information gap. No package/runtime/downstream implementation change was made by this research closure.
