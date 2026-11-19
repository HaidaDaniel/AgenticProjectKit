# Independent Self-Audit — 2026-11-19 — HEAD e1e1c44

Auditor role: independent Principal SWE / Security / Agent Harness / QA reviewer.
Scope: AgenticProjectKit source, tests, task lifecycle, downstream integrations. No fixes were implemented; no releases, tags, pushes, or downstream mutations were made.

Verdict: **NOT_READY** (conditional — see §14).

---

## 1. Executive summary

APK is a mature, internally consistent repository-local workflow CLI. The corrective work for the v0.6.0 line (tasks 0286–0289) is genuine code, not just bookkeeping: `dist` is reproducible from source, 906 source tests pass, typecheck/lint pass, and the documented downstream versions resolve to the correct peeled v0.6.0 commit.

The audit nevertheless found **three confirmed defects that matter for a release**:

- Two repository-root containment escapes in commands that were not part of the 0286–0288 hardening scope (`export --cleanup-legacy`, `audit`). Both were reproduced with artificial outside markers in disposable fixtures.
- One confirmed **false PASS** in the new doctor `ignore-entries` diagnostic (task 0288). The defect is present in the real `translator-agent/architecture/canonical-v3-plan` downstream repository and was recorded as a *success* in the task 0289 dogfood report. This is the most important finding: it is a security-adjacent check that fails open, and the project's own review/gate machinery certified it.

A fourth confirmed defect is an impossible agent instruction: `attention --json` tells the agent to "request independent review" for `blocked` tasks, which the CLI refuses by construction — and a committed test asserts this wrong behavior as expected.

Counts by confidence/severity:

| Severity | Confirmed | Strong evidence | Hypothesis |
| --- | --- | --- | --- |
| Critical | 0 | 0 | 0 |
| High | 3 | 0 | 0 |
| Medium | 5 | 0 | 0 |
| Low | 2 | 0 | 0 |
| **Total** | **10** | **0** | **0** |

Priorities: **P0 = 3** (F-001, F-002, F-003), **P1 = 2** (F-004, F-005), **P2 = 3** (F-006, F-009, F-010), **P3 = 2** (F-007, F-008).

---

## 2. Repository and release baseline

| Item | Value |
| --- | --- |
| Repository root | `/home/nodecall/projects/personal/AgenticProjectKit` |
| Branch | `main` (tracking `origin/main`) |
| HEAD | `e1e1c445edf8e0571f0ea04826a23222d7bbedc5` (`e1e1c44`) |
| Describe | `v0.6.0-23-ge1e1c44` — HEAD is 23 commits after v0.6.0 |
| Latest stable tag | `v0.6.0` (annotated) |
| **Tag object SHA** | `d83d069f5309ca2b963f8939a2626d771265979a` (not a commit) |
| **Peeled commit SHA** | `88fc21e0b6523808cb627d2707354f1d8d2128db` |
| Working tree | Dirty with two untracked files: `.tasks/0285-document-adopted-repository.md` (`State: todo`) and `docs/adoption-report.md` |
| Dirty-state policy | Both files were preserved untouched. Task files 0286–0289 explicitly identify them as unrelated WIP. |
| Task inventory | 289 tracked task files (130 active + 159 archived); 7 operational active states (4 todo, 3 blocked) |

Identity note: every corrective task file explicitly records both the annotated tag object SHA and the peeled commit SHA; the audit verified both with `git rev-parse v0.6.0` and `git rev-parse v0.6.0^{commit}`. No audit conclusion uses the tag object as a commit.

Source/build consistency: `pnpm build` exits 0 and leaves `dist` with zero drift. The committed `dist` matches source. `apk --version` reports `agentic-project-kit 0.6.0` despite HEAD being post-tag; this is a version-staleness observation, not a correctness bug for the audited candidate.

---

## 3. Recent task implementation review

| Task | Contract | Implementation commit | Audit finding |
| --- | --- | --- | --- |
| 0286 | Contain sync/export writes | `0bca258` | Implemented as specified. `resolveContainedWriteBatch` preflights the exact write set; skipped symlinks stay untouched; batch abort before first write. No defect found in scope. Gap found *outside* scope: legacy cleanup deletion (F-001). |
| 0287 | Contain init/gitignore writes | `4526736` | Implemented as specified. lstat-based containment over all starter files and `.gitignore` before mutation; `existing` symlink refused. No defect found. |
| 0288 | Doctor missing-ignore diagnostic | `6743c19` | **Defective.** Family-level probe proves one member and reports all members as effectively ignored (F-003). Shipped without independent review (F-005). |
| 0289 | Downstream dogfood + release check | `55e1e60`, `b667a42` | Honest about lint warnings and failed intermediate release attempts, but recorded the doctor false PASS as a legitimate success (F-003). No source/dist changes. |

No tasks after 0289 exist. `docs/progress.md` and the dogfood report are the latest lifecycle records.

Verification evidence in `.agentic/evidence.jsonl` was inspected directly (not trusted from task files): 0286/0287 have independent review pass + completion; 0288 has automated checks + completion only; 0289 has a `changes_requested` review, correction, then pass. All four completions are recorded. The gate cannot detect semantic defects — confirmed by F-003 remaining invisible to `apk task gate 0288` (currently `Gate: pass`).

---

## 4. Confirmed defects

### F-001 — `export --cleanup-legacy` deletes outside the repository through a symlinked ancestor

- **Severity:** High. **Category:** Security / destructive filesystem containment. **Confidence:** Confirmed.
- **Component/files:** `src/core/exporters/index.ts:466-481` (and built `dist/core/exporters/index.js`); CLI `src/cli/commands/export.ts:71-83`.
- **Identity:** `main` @ `e1e1c44`; present since before v0.6.0 and unchanged by 0286–0289.
- **Observed:** With `repo/.codex` a symlink to a sibling `outside/` directory containing an exact legacy-rendered `instructions.md`, `apk export --report-legacy` reports `generated .codex/instructions.md`, and `apk export --cleanup-legacy` exits 0 after printing `Removed 1 obsolete generated file(s)`. The outside marker is deleted (`ENOENT`).
- **Expected:** Refuse before any deletion when a final component or ancestor is a symlink, or when the path escapes the repository root; exit non-zero; outside marker unchanged.
- **Reproduction:** `/tmp/opencode/apk-audit-legacy/repro.mjs` (isolated fixture, artificial marker only). Output: `REMOVED OUTSIDE FILE: true`.
- **Root cause:** `cleanupLegacyAgentExports` calls `rm(join(rootDirectory, finding.outputPath), { force: true })` with no `resolveContainedRepositoryPath`/`resolveContainedWriteBatch` preflight. Task 0286 hardened `writeAgentExportFiles` and `syncAgentExports` but not the legacy *deletion* path.
- **Impact:** An attacker who can place a symlink and a matching legacy file in a repository can cause `apk export --cleanup-legacy` to delete an arbitrary file outside the repository. Confirmed destructive escape.
- **Remediation:** Preflight every `generated` finding with a contained-delete helper that uses `resolveContainedRepositoryPath(..., "file")` (refuse symlink final component and symlinked ancestors) before the first `rm`; classify/read through lstat, not following reads; batch-abort on any refusal.
- **Regression test:** Add export CLI test with symlinked ancestor to an outside marker containing exact legacy content; assert non-zero exit, containment error, and byte-identical marker. Include dangling final symlink and symlinked intermediate directory cases.
- **Residual:** Pre-mutation TOCTOU remains, consistent with the documented boundary.

### F-002 — `apk audit` writes reports through a symlinked `docs/` ancestor and ignores configured `docsDirectory`

- **Severity:** High. **Category:** Security / write containment. **Confidence:** Confirmed.
- **Component/files:** `src/core/audit/index.ts:30-31,372-377`.
- **Identity:** `main` @ `e1e1c44`.
- **Observed:** With `repo/docs` a symlink to a sibling `outside/` dir containing `audit-report.md` with marker bytes `DO-NOT-TOUCH`, `apk audit` exits 0 and overwrites the outside file with the audit report.
- **Expected:** Containment preflight for `docs/audit-report.md` and `docs/project-map.md`, refusing symlinked final components/ancestors and escaping roots; non-zero exit and no outside write.
- **Secondary observation:** Both paths are hardcoded `docs/...` and do not honor `.agentic/config.json` `docsDirectory`, even though config exposes that field and other docs consumers use it.
- **Reproduction:** `/tmp/opencode/apk-audit-legacy/repro-audit.mjs`. Output: `OUTSIDE MARKER: CHANGED -> # Audit Report`.
- **Root cause:** Audit writes via `join(rootDirectory, AUDIT_REPORT_PATH)` with no containment helper; the 0262/0265/0268/0275 hardening covered configured runtime/task paths, and 0286 covered sync/export, but audit report writes were not included.
- **Impact:** Arbitrary file overwrite outside the repository when `docs/` or a report file is a symlink; additionally, a misconfigured `docsDirectory` is silently ignored.
- **Remediation:** Route both report paths through `resolveContainedWriteBatch` before `mkdir`/`writeFile`; resolve `docsDirectory` from config or document explicitly that these two paths are fixed.
- **Regression test:** Audit tests for symlinked `docs/`, symlinked final report file, and custom `docsDirectory`; assert no outside write and non-zero exit.

### F-003 — Doctor `ignore-entries` check falsely proves effective ignore for family members

- **Severity:** High. **Category:** Correctness / security diagnostic (fail-open). **Confidence:** Confirmed.
- **Component/files:** `src/core/doctor/index.ts:41-95,211-267`; canonical list `src/core/init/index.ts:33-52`; downstream record `docs/delivery/downstream-v060-corrective-dogfood.md:39`.
- **Identity:** `main` @ `e1e1c44`; introduced by `6743c19` (task 0288).
- **Observed:** In a controlled git fixture whose `.gitignore` contains every canonical entry except `.agentic/perf/*`, doctor reports `pass`: `.agentic/perf/*: ignored via .gitignore:4:.agentic/agents/*`. In real `translator-agent` @ `3efa338` (branch `architecture/canonical-v3-plan`), `.gitignore` lacks `.agentic/perf/*`; `git check-ignore -v --no-index .agentic/perf/x` exits 1 (not ignored), but doctor reports an informational pass via `.gitignore:34:.agentic/agents/*`. The dogfood report records this as a valid canonical-string-absent/effectively-ignored case.
- **Expected:** Per task 0288 acceptance: "Classify each canonical entry separately by canonical-string presence and by effective Git ignore behavior." A missing entry without a proven matching rule must be a `warn`, never a proven pass.
- **Reproduction:** `/tmp/opencode/apk-audit-legacy/repro-doctor.mjs`; real downstream direct `git check-ignore` check shown in §9.
- **Root cause:** `IGNORE_PROBE_FAMILIES` maps several canonical entries to one representative `probePath`. A match on the representative marks *all* entries in the family proven (`src/core/doctor/index.ts:240-253`). The task contract simultaneously demanded per-entry classification and at most eight probe paths — an internal contradiction resolved in favor of the bound. For `expect: "reinclude"`, the check also accepts any `!`-prefixed pattern on the representative without verifying that the specific `.gitkeep` is actually re-included.
- **Impact:** The check silently misses genuinely unignored operational paths (including `.agentic/perf/*`, reviews, sessions, workspaces). In translator-agent this leaves a real unignored runtime directory; if traces/records are written there they can be committed. More importantly, the dogfood evidence demonstrates the review/gate pipeline can certify a failed security control.
- **Remediation:** Probe each canonical entry with its own path in a single `git check-ignore --stdin` invocation (19 paths, still one process). For reinclude entries, prove the exact path is not ignored while its parent pattern would ignore it. Keep the one-process/5s/4 MiB bounds; revise the task bound from "eight representative paths" to "eight or fewer processes / all entries in one process".
- **Regression test:** Negative path where family representative `.agentic/agents/sample.jsonl` is ignored but `.agentic/perf/*` is not; assert `warn` naming `.agentic/perf/*`. Add a reinclude false-positive case. Correct the dogfood report line 39.
- **Confidence note:** The false PASS is confirmed; actual secret leakage is *potential*, not observed.

### F-004 — `attention` recommends an impossible review action for blocked tasks

- **Severity:** Medium. **Category:** Lifecycle / agent-harness correctness. **Confidence:** Confirmed.
- **Component/files:** `src/core/status/attention.ts:97-145`; guard `src/core/tasks/review.ts:239-248`; test `src/cli/cli.test.ts:603-605`.
- **Identity:** `main` @ `e1e1c44`.
- **Observed:** On this repo, `apk attention --json` reports for blocked tasks 0150 and 0221: `nextAction: "request independent review for 0150"` while their blockers include scope violations, missing verification evidence, and a blocked dependency. `apk review` cannot accept these tasks: `requireReviewableTask` throws `Task ... is blocked; expected doing or review for independent review` and also requires a non-`none` owner.
- **Expected:** `nextAction` must be executable for the reported state; a blocked task should be told to resolve its actual blockers.
- **Reproduction:** `apk attention --json` (read-only) plus source guard inspection.
- **Root cause:** `attentionAction` checks gate status, budget, and review status but never checks `status.state === "blocked"` before falling through to the review-based branches (`src/core/status/attention.ts:141-143`).
- **Impact:** Autonomous agents following `attention --json` waste tool calls and potentially paid review attempts on tasks that cannot be reviewed; misleading diagnostic in every repo with blocked tasks (translator-agent has 11, tele-agent 11).
- **Remediation:** Handle `blocked` state before review-derived actions; return `resolve blockers for <id>` (or the gate's first actionable blocker). Only suggest review when state is `doing`/`review`, owner is set, and remaining blockers are review-only.
- **Regression test:** Update `src/cli/cli.test.ts:605` scenario "blocked missing review" to expect a blocker-resolution action, and add a scenario with blocked + scope + dependency blockers.
- **Note:** The existing test currently **encodes the wrong behavior as expected** — a case of a test reproducing implementation assumptions rather than the contract.

### F-005 — Security-adjacent task 0288 shipped without independent review

- **Severity:** Medium. **Category:** Release confidence / assurance policy. **Confidence:** Confirmed.
- **Component/files:** `src/core/tasks/policy.ts` (risk defaults); `.tasks/0288-...md:8-11`; `.agentic/evidence.jsonl` 0288 records.
- **Identity:** `main` @ `e1e1c44`.
- **Observed:** `apk task policy 0288` → `Risk: medium`, `independent review: not required`, `minimum assurance: self-check`. Evidence contains six automated checks and a completion, no review record. The change altered what doctor reports as safe, and contains F-003.
- **Expected:** A change that adds or modifies a diagnostic whose output gates "safe to commit" claims should receive independent review or at least a mandatory negative-path review, regardless of the `p2`/`diagnostics` tag.
- **Root cause:** Risk classification keys on `risk` and generic tags; `diagnostics`/`gitignore`/`read-only` do not raise assurance. High-risk siblings 0286/0287 received review; 0288 did not.
- **Impact:** Demonstrates a concrete path by which APK can certify itself incorrectly. The gate evaluates process compliance, not semantics.
- **Remediation:** Add classification rules that require independent review for tags `security|containment|gitignore|diagnostics` when the change affects safety reports; require at least one negative-path test asserting the diagnostic *warns* for an unsafe configuration.
- **Regression test:** Unit test in `src/core/tasks/task.test.ts` asserting a medium-risk `gitignore,diagnostics` task resolves `independentReview: true`.

### F-006 — `status`/`attention` and the source test suite have material wall-clock cost in agent loops

- **Severity:** Medium. **Category:** Performance (measured). **Confidence:** Confirmed.
- **Identity:** `main` @ `e1e1c44`, Linux, Node v24, 5-run averages.
- **Measured (APK, 289 task files):** `node -e ""` 25 ms; `apk --version` 34 ms; `tasks` 217 ms; `workers --json` 131 ms; `doctor` 363 ms; `lint --json` 524 ms; `attention --json` 1051 ms; `status --detail` 1107 ms. On media-core (76 task files): `status --detail` 308 ms, `attention --json` 273 ms. `pnpm test:source` (906 tests) took 140 s; `pnpm build` clean.
- **Observation:** Cost scales roughly linearly with total task files (~3.5 ms/task) even though `status --detail` only reports seven operational tasks. Both commands re-read and re-parse the whole inventory, including 159 archived files.
- **Root cause hypothesis:** Full inventory parse + baseline/scope/lineage git work per invocation. The existing `withDiagnosticSnapshot` and task 0229 snapshot avoid *duplicate* reads within one invocation but do not avoid reads across invocations.
- **Impact:** Agents that call `status --detail`, `attention --json`, and `lint --json` repeatedly pay ~1 s each; on large archives this compounds.
- **Remediation:** Profile first (the repository has a perf harness at `scripts/benchmarks/perf-harness.mjs`). Consider a read-only projection that skips archived files for active-state queries, or an invocation-local cache shared by `status`/`attention`/`lint`. Do **not** add a cross-process cache without a measured benefit and an explicit invalidation strategy tied to file mtimes/Git HEAD.
- **Regression test:** Add a harness workload asserting a bounded time ratio for `status --detail` between 76- and 289-task fixtures; keep it advisory, not a hard threshold.

### F-007 — `typescript` and `@types/node` are runtime dependencies

- **Severity:** Low. **Category:** Packaging / maintainability. **Confidence:** Confirmed.
- **Component/files:** `package.json:57-61`.
- **Observed:** `dependencies` contains `typescript` and `@types/node`; repository-wide search finds no non-test source import of `typescript`, and `@types/node` is compile-time only. Only `handlebars` is a true runtime dependency.
- **Impact:** Downstream dev-tooling installs pull the TypeScript compiler and Node type packages unnecessarily.
- **Remediation:** Move both to `devDependencies`; verify `pnpm build`, `typecheck`, and tests still pass.
- **Regression test:** `pnpm install --prod --frozen-lockfile` followed by `node dist/cli/index.js --version` in a clean fixture.

### F-008 — JSON output coverage is inconsistent across CLI commands

- **Severity:** Low. **Category:** CLI usability. **Confidence:** Confirmed.
- **Component/files:** `src/cli/index.ts`, `src/cli/command-registry.ts`.
- **Observed:** `tasks --json` → `Unknown option: --json` (exit 1); `status --json` → usage error (exit 1); `help` → `Unknown command: help` (exit 1); `--help` works. `attention --json`, `workers --json`, `lint --json`, `quality detect --json` work.
- **Impact:** Agents must parse tabular output or use indirect commands; discoverability of `--help` is not obvious from the error for `help`.
- **Remediation:** Add `--json` to `tasks` and `status`, or document `attention --json` as the canonical machine-readable projection; make `help` an alias of `--help`.
- **Regression test:** CLI tests asserting JSON parseability and exit codes for each public projection.

### F-009 — Downstream must hide external benchmark paths from task contracts to satisfy `apk lint`

- **Severity:** Medium. **Category:** Downstream integration / agent workflow. **Confidence:** Confirmed.
- **Component/files:** translator-agent commit `3efa338` on `architecture/canonical-v3-plan`; `.tasks/0338-add-deepseek-v4-1-flash-independent-qa-over-book-bible-and-translations.md:47,95`.
- **Observed:** Two absolute external run-root paths were removed from the task's `Context files` and relocated into a prose `Notes` bullet ("Recorded here as operator context, not repository path patterns") to satisfy `apk lint` context-reference checks. The paths remain legitimate read-only evidence for expensive/paid experiments.
- **Expected:** A safe, machine-readable way to reference external read-only evidence in a task contract without lint treating it as a missing repository path.
- **Root cause:** `src/core/audit/lint.ts:319-328` treats every `contextFiles` entry as a repository-relative path and emits `context-reference-missing` advisories for absolute paths; no declared "external reference" category exists.
- **Impact:** Loss of structured provenance for benchmark evidence; downstream workaround is to make the paths invisible to tooling. This is exactly the "paid experiments vs APK gates" friction the audit was asked to examine. No evidence was found that validation reruns paid experiments or overwrites benchmark evidence — APK's lint is read-only — but the contract representation is degraded.
- **Remediation:** Support an explicit `external evidence` field in task contracts (or a path-prefix allowlist in config) that lint validates as advisory/read-only and excludes from repository-relative resolution; document in `docs/task-system.md` and generated AGENTS.md policy.
- **Regression test:** Lint test with a task declaring an external evidence path; assert no `context-reference-missing` advisory and that the path is preserved in machine-readable form.

### F-010 — Monolithic task engine and very large context bundles

- **Severity:** Medium. **Category:** Architecture / maintainability / agent token overhead. **Confidence:** Confirmed (measurements), impact assessed.
- **Observed:** `src/core/tasks/index.ts` is 6,734 lines / 264 KB; several other core modules exceed 30 KB. `docs/decisions.md` is 2,147 lines / 180 KB and `docs/task-system.md` 827 lines / 117 KB. `apk context 0286 --level 2` lists nine files including both large docs; measured file sizes total roughly 385 KB (~96 K "units" at APK's 4-bytes/unit convention). `apk lint --json` reports `initialLoadUnits: 1,212,165` across 323 unique files (aggregate over all non-archived tasks, advisory).
- **Expected:** Routine bugfix work should not require loading an entire ADR history and a 117 KB task-system manual.
- **Root cause:** Context selection operates at whole-file granularity; no section-level or profile-level selection. The task engine accumulated responsibilities (claim, scope, evidence, review, gate, provenance, epochs, archive, workspaces) in one module.
- **Impact:** High per-task token/context cost for downstream agents; harder maintenance and review of the largest module.
- **Remediation:** (a) Add section-level context selection (e.g., `apk context <id> --level 3 --section gate`) or curated "bugfix"/"docs" profiles that omit full ADR docs. (b) Split `src/core/tasks/index.ts` by responsibility along existing submodules (`evidence.ts`, `gate.ts`, `review.ts`, `provenance.ts`, `lock.ts` already exist). Migration cost L; benefit is measurable context reduction and smaller review surface. No full rewrite recommended.

---

## 5. Security findings

Categories requested by the audit:

1. **Verified vulnerabilities:** F-001 (destructive escape via `export --cleanup-legacy`), F-002 (write escape via `audit`), F-003 (fail-open safety diagnostic). All reproduced with isolated fixtures or real downstream data.
2. **Verified correctness bugs without demonstrated security impact:** F-004 (impossible next action), F-005 (assurance classification), F-008 (JSON/help inconsistency), F-009 (external-path workaround).
3. **Residual risks (documented in project, not reproduced here):** TOCTOU in `resolveContainedRepositoryPath` between preflight and mutation; cross-host lock ownership is conservatively `uncertain`; Windows symlink privilege behavior untested.
4. **Theoretical concerns without reproduction:** None raised. I did not claim PID-reuse, case-insensitive path, or worktree marker issues without evidence.

Areas checked with no finding: `resolveContainedRepositoryPath`/`resolveContainedWriteBatch` (correct lstat walk, symlink refusal, escape check); `initProject` and `ensureApkGitignore` (batch preflight before mutation); `writeAgentExportFiles` and `syncAgentExports` (exact write set preflight; skipped symlink untouched); `migrateAgentLogs --remove-legacy` (contained before removal); analytics/config writes (contained); lock implementation (PID + process-start identity + hostname, recovery guard, no live-lock stealing); workspace removal (ownership/safety assessment, contained record deletion); doctor itself (read-only; no writes).

---

## 6. Architecture findings

- Layering is coherent: CLI handlers are thin, domain logic is in `src/core`, policy lives in repository docs/config, and exporters render from one neutral policy. No rewrite recommended.
- `withDiagnosticSnapshot` is a sound pattern for bounding repeated git/config reads within one invocation; task 0229's snapshot reuse is visible in `status`/`attention`/`workers`.
- Duplicate-but-divergent logic exists: `normalizeLineEndings` in `src/core/sync/index.ts:32-34` (`\r\n` only) vs `src/core/exporters/index.ts:409-411` (`\r\n?`). No confirmed user-visible failure, but it is a drift risk.
- `docs/decisions.md` (180 KB) and `docs/task-system.md` (117 KB) are close to being de facto source code; schema evolution is documented but expensive to consume (F-010).
- `typescript`/`@types/node` in runtime dependencies (F-007) is a packaging boundary error.
- Source/build consistency is good: deterministic `pnpm build`, committed `dist`, and `build-current` verification in each corrective task.

---

## 7. Performance measurements

Environment: Linux, Node v24, committed `dist`, 5-run averages (wall clock, command-line tooling included).

| Command | APK (289 task files) | media-core (76 task files) |
| --- | --- | --- |
| `node -e ""` | 25 ms | — |
| `apk --version` | 34 ms | — |
| `apk tasks` | 217 ms | 179 ms |
| `apk workers --json` | 131 ms | — |
| `apk doctor` | 363 ms | 250 ms |
| `apk lint --json` | 524 ms | 327 ms |
| `apk attention --json` | 1051 ms | 273 ms |
| `apk status --detail` | 1107 ms | 308 ms |
| `pnpm test:source` (906 tests) | 140 s | — |

Interpretation: CLI cold start is negligible (~9 ms above Node baseline). The cost is in inventory scanning, parsing, and Git/scope work, scaling with total task files. `apk perf` tracing exists but was not used here to avoid mutating `.agentic/perf`. The documented v0.5.0 harness reports tracing overhead of ≤1%; no new cache is proposed without a fresh profile (F-006).

---

## 8. Agent workflow findings

- **Confirmed impossible instruction:** F-004 — `attention` suggests review for blocked tasks; the test suite asserts this as correct.
- **Context overhead:** F-010 — routine bugfix context bundles include entire ADR and task-system manuals; `lint` reports 31 `context-reference-missing` advisories on this repo and a 1.2 M-unit aggregate estimate.
- **Review/gate trust:** F-003 + F-005 show that a security-relevant diagnostic can fail open and still receive a passing gate and dogfood report. This is the clearest "circular trust" instance: the implementation owner's tests, the medium-risk classifier, and the downstream dogfood all agreed on a false PASS.
- **Downstream workaround:** F-009 — external evidence paths hidden from structured task metadata.
- **Positive observations:** `apk next-task`, `claim`, `context`, and worker projections are deterministic; blocked/completed tasks remain visible in `status --detail` and `attention --json` (no disappearance due to unusual state); locks expose honest PID/host diagnostics in `status` while `attention` sanitizes them.

---

## 9. Downstream integration findings

All five available repositories were inspected **read-only**; none was modified.

| Repository | Branch / HEAD | APK pin | Lock resolution | Notes |
| --- | --- | --- | --- | --- |
| translator-agent | `architecture/canonical-v3-plan` @ `3efa338` | `github:...#v0.6.0` | codeload tar of `88fc21e0` | Dev-only manifest states Python runtime has no Node/APK dependency; installed version 0.6.0; 45 todo / 11 blocked / 6 done tasks. |
| media-core | `main` @ `7682926` | `#v0.6.0` | `88fc21e0` | 75 done, 1 canceled; canonical ignore entries present. |
| resledger | `main` @ `b43b1c6` | `#v0.6.0` | `88fc21e0` | 182 done, 1 blocked, 1 canceled. |
| tele-agent | `master` @ `3b0c30e` | `#v0.6.0` | `88fc21e0` | `agentStyle: caveman` is an explicit config choice; 11 blocked tasks. |
| Image-agent | `main` @ `ea6743b` | `#v0.6.0` | `88fc21e0` | 19 done, 1 blocked, 1 todo. |

Translator Agent specifics:

- Development-only status verified: `package.json` explicitly describes itself as dev-only tooling; Python runtime (`novel_harness`) has no APK/Node dependency. No production dependency on APK was found.
- `.agentic/config.json` declares local/remote models and harnesses with `scarce-frontier` cost classes; `attention`/`gate` budget handling for frontier passes was inspected and behaves as documented.
- `apk lint --json` (candidate CLI, read-only) returned 6 warnings, all `policy-blocker` in archived tasks requiring undeclared `benchmark`/`live` categories; `hasErrors: false`. No `context-reference-missing` warnings remain after commit `3efa338`.
- **Doctor false PASS:** the repository lacks `.agentic/perf/*` and `/tmp/apk/` in `.gitignore`; `/tmp/apk/` is effectively ignored via `.git/info/exclude:9:/tmp/apk/` (correct), but `.agentic/perf/*` is **not** ignored (`git check-ignore` exit 1). Task 0289's dogfood report line 39 records the doctor pass as legitimate. See F-003.
- External benchmark evidence lives under `/home/nodecall/translator-agent-runs/` and is referenced from docs; APK does not execute or rewrite it. No paid-experiment rerun or benchmark overwrite was observed. The only friction is representational (F-009).

Limitations: `rigops` was not present locally; `translator-agent-canonical-v3` exists but is not a Git checkout. No remote fetch was performed (no network mutations, per constraints). The 0289 dogfood copies under `/tmp/opencode/apk-0289-downstream/` were treated as evidence only.

---

## 10. Testing and release-gate assessment

- `pnpm typecheck`: pass. `pnpm lint`: pass. `pnpm test:source`: 906/906 pass in 140 s. `pnpm build`: clean, no `dist` drift. These match the recorded 0289 release-check evidence.
- Tests are extensive but include the anti-pattern in F-004: `src/cli/cli.test.ts:605` asserts an impossible action. Doctor tests (`src/core/doctor/doctor.test.ts:305-410`) cover missing entries, .git/info/exclude, nested .gitignore, negation, and exit-code classes but **not** the family false-positive (F-003).
- Gate evaluation is process/provenance-based; `apk task gate 0288` currently reports `Gate: pass` although F-003 is real. This is expected by design but must be stated plainly: the gate is not a semantic verifier.
- Circularity: task 0288's own tests and medium-risk classification, plus task 0289's downstream report, all certified the false PASS. Independent review was absent for 0288 (F-005) and the 0289 reviewer corrected only a documentation wording issue, not the diagnostic logic.
- Release checks do not cover containment of `export --cleanup-legacy` or `audit` report writes (F-001/F-002), nor Windows symlink behavior.

---

## 11. Proposed improvements (beyond fixes)

| ID | Improvement | Benefit | Complexity | Regression risk | Core/downstream |
| --- | --- | --- | --- | --- | --- |
| I-1 | One contained-write abstraction used by every mutating command, with delete variants | Closes the class of escape bugs (F-001/F-002) | M | Low | Core |
| I-2 | Per-entry ignore probing in one `git check-ignore` call | Restores diagnostic truth (F-003) | S | Low | Core |
| I-3 | Actionable next-step resolver shared by `attention`/`status`, state-aware | Removes impossible instructions (F-004) | S | Low | Core |
| I-4 | Assurance rule for safety-affecting diagnostics | Prevents self-certification (F-005) | S | Low | Core |
| I-5 | `external evidence` task metadata category | Preserves downstream paid-experiment provenance (F-009) | S/M | Low | Core + docs |
| I-6 | Section-level context selection / curated profiles | Measurable token reduction (F-010) | M | Medium | Core |
| I-7 | Profile `status`/`attention` before any cache; skip archives for active queries | Reduces agent-loop latency (F-006) | M | Medium | Core |
| I-8 | Move type-only deps to devDependencies | Smaller installs (F-007) | S | Low | Core |
| I-9 | `--json` for `tasks`/`status`; `help` alias | Agent ergonomics (F-008) | S | Low | Core |

No speculative features are proposed.

---

## 12. Prioritized corrective backlog

### Ready-to-import task specifications (not created — see §15)

| Priority | Proposed ID | Title | Depends on | Complexity | Blocks next release? |
| --- | --- | --- | --- | --- | --- |
| **P0** | 0290 | Contain legacy export cleanup deletions inside the repository | none | S | **Yes** |
| **P0** | 0291 | Contain audit report writes inside the repository | 0290 (reuse helper) | S | **Yes** |
| **P0** | 0292 | Probe every canonical ignore entry independently in doctor | none | S | **Yes** |
| **P1** | 0293 | Make attention next actions state-aware and executable | none | S | No |
| **P1** | 0294 | Require independent review for safety-reporting diagnostics | none | S | No |
| **P2** | 0295 | Support external read-only evidence references in task contracts | none | M | No |
| **P2** | 0296 | Profile and reduce repeated task-inventory work in status/attention | none | M | No |
| **P2** | 0297 | Provide section-level context selection for routine tasks | 0296 (optional) | M | No |
| **P3** | 0298 | Correct runtime/dev dependency split | none | S | No |
| **P3** | 0299 | Add JSON projections for tasks/status and a `help` alias | none | S | No |

Execution order: **0290 → 0291 (share one helper)**, **0292 independently**, then **0293 → 0294**, then the P2/P3 items. 0292 should be first if only one task can be done, because it has a real downstream false-PASS in production data.

### Acceptance criteria and verification requirements

**0290 — Contain legacy export cleanup deletions**
- Goal: `classifyLegacyAgentExports` and `cleanupLegacyAgentExports` refuse symlink final components, symlinked ancestors, absolute/traversing paths, and escaping roots before any `rm`; atomic batch abort.
- Allowed files: `src/core/config/paths.ts`, `src/core/exporters/index.ts`, `src/core/exporters/*.test.ts` or `src/core/templates/renderer.test.ts`, `src/cli/cli.test.ts`, `docs/agent-exporters.md`, `dist/**`.
- Negative tests: symlinked ancestor with outside marker + exact legacy content; dangling final symlink; nested symlinked directory; valid-first/symlink-second batch atomicity; normal `--report-legacy`/`--cleanup-legacy` unchanged.
- Verification: focused exporter/CLI tests, typecheck, lint, `apk lint`, build-current, manual repro report with exact exit codes and byte-identical markers.

**0291 — Contain audit report writes**
- Goal: both report paths resolved via the contained-write helper before `mkdir`/`writeFile`; decide and document whether `docsDirectory` config is honored; never write outside repo; no symlink following.
- Allowed files: `src/core/audit/index.ts`, `src/core/audit/audit.test.ts`, `docs/cli-commands.md`, `dist/**`.
- Negative tests: symlinked `docs/`, symlinked final `audit-report.md`, custom `docsDirectory`, ordinary audit output unchanged.
- Verification: focused audit tests, typecheck, lint, docs tests, build-current, repro report.

**0292 — Per-entry ignore probing in doctor**
- Goal: every canonical entry classified individually; one `git check-ignore` process; reinclude entries proven for the exact `.gitkeep`; unavailable inspection stays `warn`/`unavailable`; correct dogfood report line 39.
- Allowed files: `src/core/doctor/index.ts`, `src/core/doctor/doctor.test.ts`, `docs/cli-commands.md`, `docs/delivery/downstream-v060-corrective-dogfood.md`, `dist/**`.
- Negative tests: family representative ignored while another member is not (must `warn` and name `.agentic/perf/*`); reinclude false positive; exit 0/1/128; malformed output; byte-for-byte no writes.
- Verification: focused doctor tests, docs tests, typecheck, lint, build-current, real downstream `translator-agent` recheck showing `warn` for `.agentic/perf/*`.

**0293 — State-aware attention actions**
- Goal: no `nextAction` may recommend an action the CLI refuses for that state; blocked tasks return a blocker-resolution action; ownerless/review-state rules respected.
- Allowed files: `src/core/status/attention.ts`, `src/cli/cli.test.ts`, `docs/cli-commands.md`, `dist/**`.
- Negative tests: update `src/cli/cli.test.ts:605`; blocked + scope + dependency; blocked + owner none; doing + missing review still suggests review.
- Verification: focused CLI tests, typecheck, lint, build-current, `attention --json` on this repo showing no impossible actions.

**0294 — Assurance for safety-reporting diagnostics**
- Goal: tags `security|containment|gitignore|diagnostics` on changes that alter safety reports require independent review; medium-risk default not sufficient.
- Allowed files: `src/core/tasks/policy.ts`, `src/core/tasks/task.test.ts`, `docs/task-system.md`, `dist/**`.
- Negative tests: policy resolution for medium-risk diagnostics task; unaffected legacy task policies.
- Verification: focused task tests, typecheck, lint, `apk lint`, build-current.

**0295–0299** follow the same bounded pattern: narrow allowed files, negative-path tests, focused checks before canonical verification once, commit before final verify. Full details are derived from F-006…F-010 above.

---

## 13. Risks and limitations

- No Windows testing; symlink privilege behavior remains unverified. All reproductions are Linux.
- Adversarial tests used only artificial markers in disposable `/tmp` fixtures; no downstream working tree was mutated.
- Paid model calls and Translator Agent benchmarks were not run; downstream conclusions are from repository state and read-only commands.
- Network/remote fetches were not performed; `rigops` and a Git checkout of `translator-agent-canonical-v3` were unavailable locally and are reported, not substituted.
- The two untracked files in the audited checkout were preserved and were not edited.
- F-003's "potential secret leakage" is explicitly not an observed leak; only the false PASS is confirmed.
- No release tags, commits to task states, or APK task files were created by this audit (see §15).

---

## 14. Final release-readiness verdict

**NOT_READY** for the next stable tag as of HEAD `e1e1c44`.

Rationale: three confirmed P0 defects are present in the candidate that would be tagged. F-001 and F-002 are verified repository-root escapes (one destructive) in public commands, and F-003 is a verified fail-open in a security-relevant diagnostic with a real downstream false PASS that the project's own gate and dogfood certified. The remaining findings are non-blocking but should be scheduled.

Reassessment criteria for `READY_WITH_NON_BLOCKING_ISSUES`:
1. 0290, 0291, 0292 implemented with negative-path regressions, committed, and independently reviewed.
2. `translator-agent/architecture/canonical-v3-plan` doctor check warns for `.agentic/perf/*` and the dogfood report is corrected.
3. Full `pnpm release:check` passes on the new candidate with source/`dist` parity.
4. No new containment escape found in a re-run of the `git grep` mutation-site inventory.

If the operator explicitly accepts F-001/F-002/F-003 as known issues with documented workarounds and does not include them in the next tag, the verdict could become `READY_WITH_NON_BLOCKING_ISSUES`; this audit does not make that decision.

---

## 15. APK task creation decision

I did **not** create actual `.tasks/*.md` files. Reasons:

1. The audit was required to be non-mutating apart from this report; the checkout already contains untracked WIP from another agent (`.tasks/0285`, `docs/adoption-report.md`) that must remain untouched.
2. `apk task create` can produce planning-only `todo` tasks without claiming them, but doing so would add durable backlog items to a shared repository before a human has prioritized the audit's findings. The workflow supports it technically; the audit policy does not authorize it here.
3. The corrective IDs and complete, bounded specifications are provided in §12 and can be imported by the operator with `apk task create` (or by applying a reviewed task-generation patch) in the desired order.

No existing task states were changed and no task was claimed, reviewed, or completed during this audit.
