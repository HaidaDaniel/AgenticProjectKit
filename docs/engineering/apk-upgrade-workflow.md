# Agent-driven APK upgrade workflow research

Status: accepted research conclusion
Task: 0126
Date: 2026-09-14

## Decision

Use an **agent-driven repository upgrade workflow composed from existing deterministic APK primitives**. Do not add a monolithic `apk upgrade` command and do not make APK own package-manager mutation, repository-specific merge decisions, provider execution, or automatic commits.

The first implementation follow-up should be a reusable, manually invoked upgrade instruction/skill that tells an external coding agent how to inspect, plan, apply, verify, and recover a repository-specific APK tooling migration. APK remains responsible for deterministic repository facts and safe bounded operations. The agent/operator remains responsible for repository-specific reasoning and material decisions.

A new CLI surface is justified only if future dogfood demonstrates a concrete information gap that cannot be assembled reliably from existing commands. The strongest candidate is a **read-only installed/declared-version and compatibility report**, not an imperative migration engine. Do not create that command merely for symmetry.

## Why this architecture

APK already exposes most of the primitives needed for a safe upgrade:

- project-local pinned package installation;
- release/tag discipline with committed runnable `dist`;
- `adopt --preview` / explicit apply semantics for bounded adoption compatibility;
- canonical generated-file ownership and sync checking/writing;
- doctor, lint, audit, quality detection, task status and provenance;
- legacy generated-file classification/cleanup that distinguishes known generated content from customized files;
- task/evidence freshness, candidate identity, scope attribution and completion provenance;
- repository-local execution rather than provider/model ownership.

The part that varies between repositories is the migration reasoning: which package manager owns the pin, whether generated files are customized, whether a dirty or active task makes the timing unsafe, what release notes apply, and which host-project checks prove compatibility. Encoding those decisions into one universal imperative CLI would duplicate package managers and repository-specific policy while still being unable to prove application correctness.

## Bounded downstream evidence

### ResLedger v0.4.2 -> v0.4.3

ResLedger Task 0032 is the positive example of a bounded tooling migration. Its contract:

- changed the repository-pinned APK dependency and lockfile from v0.4.2 to stable v0.4.3;
- required the installed CLI to report v0.4.3;
- regenerated/checked only APK-owned derived metadata;
- verified Go detection and APK workflow quality;
- preserved active Task 0003 state/evidence;
- explicitly forbade changes to `cmd/**`, `internal/**`, migrations and Go module files;
- ran host Go format/type/lint/test/build plus APK doctor/lint.

The recorded candidate/completion history also exposes an important limit: a tooling commit can intersect with another active task's baseline/candidate attribution. A clean doctor/lint after the upgrade does not make stale task evidence current and does not authorize baseline reset or historical rebinding.

This is evidence for a repository-aware workflow, not for a universal upgrade command.

### Translator-agent

Translator-agent remains a useful contrasting repository shape:

- Python is the application runtime;
- APK is pinned as development tooling in the root Node manifest;
- project truth and customized documentation/instructions must survive tooling changes;
- done task history and live/operational artifacts are not migration scratch space.

A mechanical package bump can be straightforward while generated/customized ownership and project-specific verification still require reasoning. That is exactly the boundary an external agent is suited to handle.

## Identity model: keep these concepts separate

A safe upgrade must not collapse several different identities into one "APK version":

| Identity | Meaning | Source/example |
| --- | --- | --- |
| Declared dependency | What the repository asks to install | `package.json` Git tag/version/SHA |
| Lock resolution | What dependency graph was resolved | `pnpm-lock.yaml` or host package-manager lock |
| Installed executable identity | What CLI will actually run | resolved project-local package / CLI `--version` or package metadata |
| Release identity | Immutable target release | Git tag and peeled commit/SHA, release notes |
| Config schema version | Repository config contract generation | `.agentic/config.json` compatibility/schema fields when present |
| Task candidate identity | Code/worktree revision being verified | APK task baseline/candidate/evidence/provenance |

`schemaVersion` is not the APK package version. A declared v0.4.3 dependency does not prove the installed executable is v0.4.3. A successful tooling migration does not make previously stale task evidence fresh.

Missing or conflicting identity is an explicit stop/diagnostic state, not permission to guess.

## Current capability / gap matrix

| Upgrade concern | Existing capability | Write behavior | Remaining gap |
| --- | --- | --- | --- |
| Repository pin | package manager manifest + lockfile | external package manager writes | No APK-owned package mutation needed |
| Immutable release target | Git tags/releases; v0.4.2/v0.4.3 release discipline | none during inspect | Agent must verify chosen tag/SHA/release notes |
| Installed CLI identity | project-local package/executable can be inspected | none | A single canonical read-only summary could improve ergonomics if repeated ambiguity is observed |
| Config compatibility | compatibility/schema reader; adopt preview/apply | preview read-only; apply bounded writes | Not a general cross-release migration engine |
| Missing kit files | `apk adopt --preview` / `--apply` | explicit bounded writes | Existing primitive is sufficient |
| Generated instructions | canonical exporter/sync | check read-only; explicit write | Agent must distinguish generated vs customized ownership before write |
| Legacy generated files | report/cleanup with exact-content classification | report read-only; cleanup explicit | Existing primitive is sufficient |
| Doctor | deterministic environment/repository diagnostics | read-only | Does not prove host application correctness |
| Lint | repository/task contract lint | read-only | Does not prove migration semantic correctness |
| Audit | repository scan/report | writes canonical report artifacts | Agent must know audit is not purely read-only |
| Host quality | detected capability + repository commands | host-specific | Agent/operator must run relevant host checks |
| Task evidence/provenance | baseline, candidate, freshness, status, provenance | workflow records | Upgrade must respect active-task freshness; no reset/rebind shortcut |
| Dirty/unmerged repository | Git state + task scope/provenance | read-only inspection | Requires repository-specific defer/isolate/continue decision |
| Release migration notes | release docs/decisions | documentation | More structured migration metadata may help later, but current evidence does not require a new engine |
| Rollback | package manager/Git plus explicit diff | repository-specific | Cannot guarantee lossless rollback of arbitrary unrelated dirty state; must preserve/stop conservatively |

## Alternatives

### A. Monolithic deterministic `apk upgrade`

Rejected.

A universal imperative command would have to own or emulate:

- npm/pnpm and potentially future installation models;
- dependency and lockfile mutation;
- release selection;
- config migrations;
- generated/customized file conflict policy;
- dirty worktree handling;
- active-task freshness consequences;
- host-project validation;
- rollback across arbitrary repository state.

That is too much repository-specific authority for APK and would make a new command appear safer/more complete than it can actually be.

### B. Agent-driven instruction/skill using existing primitives

**Selected as the initial architecture.**

Advantages:

- minimal new product surface;
- naturally repository-specific;
- can reason about release notes, customization and host stack;
- reuses existing deterministic commands rather than duplicating them;
- preserves APK's vendor-neutral control-plane boundary;
- easy to evolve as release contracts improve.

Risk: the agent needs an explicit workflow contract so it does not improvise destructive package/sync actions. That is solved by the reusable instruction and deterministic stop conditions below.

### C. Agent-driven workflow plus small deterministic primitives

Accepted only as an **evidence-triggered extension** of B.

A small read-only primitive is justified if repeated upgrades show that agents cannot reliably answer a factual question from existing surfaces. Candidate facts:

- declared APK dependency/version/tag/SHA;
- lockfile resolved source/version;
- installed package/CLI identity;
- config compatibility state;
- generated/customized ownership summary;
- applicable migration notes between two known releases.

Do not add package mutation, auto-sync, auto-commit, baseline reset, provider execution, or host-code repair to such a surface.

### D. Generated migration plan / compatibility report

Useful as a possible presentation of C, not a separate migration architecture.

A deterministic report is valuable only when its inputs are factual and bounded. It may summarize version/compatibility/ownership facts and proposed deterministic operations. It must not pretend to decide repository-specific semantic choices or mark a migration safe automatically.

### E. Simpler model: release notes + manual commands only

Too weak as the long-term supported workflow.

The current primitives are sufficient, but without a reusable instruction agents may omit installed-version checks, overwrite customization, confuse audit/report writes with read-only inspection, or ignore active-task evidence freshness. A small portable workflow asset adds value without a new runtime subsystem.

## Recommended responsibility boundary

### APK owns

- deterministic repository inspection;
- config compatibility/adoption primitives;
- generated-file ownership and sync behavior;
- doctor/lint/audit semantics;
- task scope, evidence freshness, candidate/provenance and gate semantics;
- release notes/decision records and any future machine-readable migration metadata;
- stable, vendor-neutral instructions describing those contracts.

### External agent owns

- reading the target release notes and repository-specific context;
- choosing the applicable installation mutation for that repository;
- proposing material changes to the operator;
- editing the package pin/lockfile through the repository's package manager;
- resolving customized-file conflicts conservatively;
- choosing and running host-project validation;
- inspecting the final diff and reporting unresolved risk.

### Operator owns

- approval of material/destructive choices;
- authorization to proceed when dirty/active work makes attribution ambiguous;
- release/tag selection when multiple targets are valid;
- decisions that alter customized policy/preferences or tracked operational state.

### Host project owns

- application dependencies/runtime;
- its package manager and lockfile;
- its quality/test/build commands;
- customized policy and product truth.

## Canonical upgrade workflow

### 1. Inspect

Before any write:

- identify repository root and current Git state;
- identify current declared APK pin and lock resolution;
- identify the installed project-local APK executable/version;
- identify target release tag/version and immutable commit/SHA where available;
- read release notes/decisions for intervening releases;
- inspect config compatibility/schema state;
- inspect generated/customized instruction ownership;
- inspect active APK tasks, owners, baselines/candidates and relevant evidence freshness;
- identify host-project quality capabilities/commands.

If declared, locked and installed identities disagree, stop and report the mismatch before planning migration.

### 2. Plan

Produce a bounded proposed diff with categories:

- dependency pin/lock changes;
- config compatibility/adoption changes;
- generated file updates/removals;
- documentation/report updates;
- expected host validation;
- known active-task/evidence impact.

Do not include unrelated application fixes.

### 3. Ask for material authorization when required

Explicit approval is required when the plan would:

- overwrite or remove customized files;
- change user style/resource/execution preferences;
- untrack/delete operational state;
- proceed despite unmerged/conflicting dirty work;
- change task lifecycle/baseline ownership;
- choose among materially different release/migration paths.

A routine exact version bump with canonical generated updates may proceed under normal task authorization when none of those conditions is present.

### 4. Apply the reproducible package migration

Use the host repository's package manager to change the exact APK pin and regenerate its lockfile. Prefer immutable released tags/versions/SHA. Do not use an unpinned branch as the canonical installed target.

Re-check the installed executable identity after acquisition.

### 5. Run applicable APK compatibility/adoption operations

Use existing primitives rather than handwritten equivalents:

- `apk adopt --preview` when compatibility/adoption changes may be needed;
- explicit `--apply` only for the reviewed bounded plan;
- generated legacy report before cleanup;
- cleanup only for content proven to be canonical legacy output;
- preserve unknown config keys and explicit user preferences.

Adopt is not a universal package upgrade command. Skip it when the release does not require its behavior.

### 6. Synchronize canonical generated ownership

Run sync check first. Write only canonical generated artifacts whose ownership is proven. A filename alone is not proof that an existing file is safe to overwrite.

Customized AGENTS/legacy adapter content becomes a visible conflict/proposal, not blind `sync --write` input.

### 7. Run deterministic APK checks

At minimum, as applicable:

```sh
pnpm exec apk doctor
pnpm exec apk lint --json
pnpm exec apk sync
pnpm exec apk audit
```

Remember that `audit` writes its canonical report/project-map outputs. Treat those files according to their repository ownership/ignore policy.

### 8. Run host-project quality

Run the repository's actual required checks, such as Python tests/Ruff, Go tests/vet/build, Node tests/build, etc. APK diagnostics do not substitute for application verification.

### 9. Inspect final diff and provenance

Confirm:

- only intended tooling/config/generated/report files changed;
- product/runtime code did not change unless separately authorized;
- installed APK identity matches the intended target;
- task baselines/candidates/evidence have not been silently reset or relabeled;
- any evidence made stale by the tooling commit is reported honestly;
- the tooling migration and later lifecycle bookkeeping remain distinguishable.

### 10. Commit according to repository workflow

APK should not auto-commit the migration. If the repository requires a tooling candidate commit, the agent creates it through normal Git workflow. Later task-state/bookkeeping commits remain separate when the repository's provenance rules require that distinction.

## Dirty worktree and active-task policy

| State | Default action |
| --- | --- |
| Clean, no active mutable task | Proceed with bounded plan |
| Dirty but changes are unrelated and attribution is clear | Prefer isolate/defer; proceed only when workflow can preserve exact unrelated state |
| Unmerged/conflicted | Stop; do not upgrade |
| Active task with candidate/evidence that tooling commit would affect | Prefer defer or isolated workspace; if explicitly authorized, preserve history and accept that evidence may become stale |
| Customized generated-looking file | Treat as customized until exact ownership is proven |
| Unknown/future config schema | Stop automatic apply; inspect compatibility/release guidance |

A tooling migration must never "fix" attribution by resetting a baseline, reclaiming a task to launder history, reopening/force-done, or rebinding old PASS evidence to a new candidate.

## Compatibility policy

### Supported mechanical path

A release is mechanically upgradable through the recommended workflow when:

- a reproducible current and target APK identity can be established;
- the package manager can resolve the target;
- config is recognized or the release provides an explicit supported migration path;
- generated ownership can be classified conservatively;
- no unresolved material customization conflict exists;
- host-project validation can be run.

### Preserved explicit configuration

APK preserves explicit project configuration across updates. An explicit `agentStyle: caveman`
stays schema-valid and functional after an upgrade; the `normal` default applies only when
`agentStyle` is omitted or newly generated. `apk doctor` emits a non-failing advisory when explicit
caveman is configured, so a maintainer can distinguish an intentional repository preference from
the current APK default. The advisory is read-only: it never rewrites `.agentic/config.json`, and
the maintainer removes the setting or sets it to `normal` to return to normal communication. This
is observability, not migration; it does not label the value as legacy and does not create an
`apk upgrade` command or migration engine.

### Requires proposal/operator decision

- customized generated/policy files conflict with new canonical output;
- changed release defaults would alter explicit user preferences;
- runtime/evidence files are tracked unexpectedly;
- dirty/active work makes candidate attribution ambiguous;
- multiple migration paths are valid.

### Unsupported / stop

- target identity is mutable/ambiguous;
- config schema is unknown/newer than the executing APK can interpret;
- dependency acquisition fails without a known complete rollback;
- repository is unmerged/conflicted;
- required migration would need destructive overwrite of unclassified user content;
- verification reveals product breakage outside the bounded tooling scope.

## Failure and recovery matrix

| Failure | Required behavior | Forbidden shortcut |
| --- | --- | --- |
| Target package cannot be acquired | Keep/restore previous reproducible manifest+lock state; report acquisition failure | Fall back silently to global APK or `main` |
| Declared version != installed version | Stop and resolve install identity before migration | Assume manifest is runtime truth |
| Unsupported/future config | Stop automatic apply; use release-specific documented path or defer | Rewrite schema marker to current |
| Customized generated-file conflict | Preserve file; produce bounded proposal/diff | Overwrite because filename matches |
| Sync fails partway | Preserve exact diff, stop, repair only canonical generated ownership | Delete/recreate broad instruction set blindly |
| Audit/doctor/lint failure | Classify tooling/repository contract failure and repair only within authorized scope | Modify product code opportunistically |
| Host tests/build fail | Report migration incompatibility or separate product issue; rollback tooling if appropriate | Declare success because APK lint passed |
| Tooling commit makes active-task evidence stale | Preserve historical evidence as stale and re-verify through normal task workflow | Rebind/reset baseline/evidence |
| Dirty state risks loss on rollback | Stop/defer or isolate before writes | hard reset/clean/force checkout |
| Tracked runtime should become ignored | Separate remediation decision and explicit Git index change | Assume `.gitignore` untracks/deletes it |

## What the reusable upgrade instruction should contain

A future optional/manual APK upgrade asset should be portable and small. It should instruct the agent to:

1. inspect current/target/installed identities and release notes;
2. inspect dirty/active-task/customization state;
3. produce a bounded plan before writes;
4. update exact package pin + lock using the repository's own package manager;
5. use adopt/sync/export ownership primitives rather than manual rewrites;
6. run APK deterministic checks and host quality checks;
7. inspect final diff/provenance/evidence freshness;
8. stop on explicit unsafe states and ask for material authorization only where needed.

The asset must not contain provider-specific code, credentials, package mutation implementation, hidden auto-approval, auto-commit, or a second migration state store.

## Should a new CLI be added?

**Not now.**

The research found no imperative operation that needs a new APK command. Existing commands cover the bounded mutations APK should own.

One factual gap may become worth a read-only command/report after more dogfood: a normalized version/compatibility summary joining declared dependency, lock resolution, installed executable, config compatibility and release identity. Before adding it, implementation planning must show that agents cannot obtain these facts reliably with current primitives and package-manager metadata.

If created later, such a surface must be:

- read-only by default;
- deterministic;
- package-manager-aware only to the bounded degree necessary to identify the installed APK package;
- explicit about unknown/conflicting identity;
- separate from package mutation and task completion policy.

## Migration metadata

Release notes are currently the human source for migration-relevant changes. If upgrade dogfood grows, APK may benefit from a small machine-readable release migration record containing only deterministic facts such as:

- from/to supported versions;
- config schema compatibility range;
- changed generated asset ownership/defaults;
- required explicit adoption/sync operations;
- known manual decisions;
- removed/deprecated legacy generated files.

This should be release metadata, not a migration engine. Do not create a second source of truth for tasks/evidence/config.

## Follow-up proposals, not created by this research

### Proposal 1 - Optional manual APK upgrade skill/instruction

Goal: encode the workflow above as a portable manually invoked agent asset.

Scope: inspection checklist, bounded plan, package-manager handoff, canonical APK primitives, stop/approval rules, host validation, diff/provenance review.

Acceptance: succeeds in disposable upgrades representing Node, Python+APK tooling, and Go+APK tooling; preserves customized files and reports active-task stale-evidence consequences rather than resetting them.

Dependencies/overlap: reuse 0074 adoption, 0092 ownership/export, 0110/0118 release guarantees, 0115-0117 evidence/commit boundaries, 0125 distribution decision. Do not duplicate 0123/0127 semantic review skills.

### Proposal 2 - Release migration metadata contract

Goal: make cross-release deterministic migration facts easy for agents to inspect.

Scope: release-owned metadata/doc schema only; no execution engine.

Acceptance: current/target compatibility and changed generated/config defaults are explicit; missing metadata remains an honest unknown; historical releases need not be rewritten retroactively unless useful.

Dependencies: release process/versioning docs.

### Proposal 3 - Read-only APK installation/compatibility report, only if dogfood justifies it

Goal: join declared, locked, installed, release and config identities into one deterministic diagnostic.

Scope: read-only report; no dependency writes, no auto-upgrade.

Acceptance: detects mismatch/unknown states, supports repo-local concurrent versions, never confuses config schema with package version.

Trigger for creation: at least two real upgrade sessions show repeated identity ambiguity or unstable hand-built inspection logic.

## Non-responsibilities of APK upgrade tooling

APK must not own:

- provider/model runtime;
- arbitrary package-manager replacement;
- automatic dependency rewriting across every ecosystem;
- product code repair;
- automatic stopping/restarting of workers;
- destructive cleanup of dirty state;
- automatic baseline reset/reclaim/reopen/force-done;
- evidence rebinding;
- automatic Git commits/amends/forces;
- universal rollback guarantees.

## Research conclusion

The current control plane is already capable of safe bounded upgrades when a competent agent follows an explicit workflow. The missing product is primarily **procedural guidance**, not a migration engine.

Start with a reusable agent-driven upgrade instruction using existing deterministic primitives. Add small read-only facts/metadata later only when real dogfood proves that existing surfaces leave a repeated ambiguity. Keep material repository decisions visible to the operator and keep task/evidence history immutable.

**Accepted architecture: agent-driven upgrade over existing deterministic APK primitives; no monolithic `apk upgrade` command.**
