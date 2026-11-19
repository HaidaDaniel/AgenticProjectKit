# Corrective Planning Pass — 2026-11-19 — HEAD e1e1c44

Companion to `2026-11-19-e1e1c44-independent-audit.md`. Planning only: no implementation fixes, releases, tags, pushes, downstream mutations or paid benchmark execution.

## Revalidation of the three P0 findings

| Finding | Exact call path | Trust boundary violated | Status |
| --- | --- | --- | --- |
| F-001 | `runExportCommand` → `cleanupLegacyAgentExports` (`src/core/exporters/index.ts:466-492`) → `classifyLegacyAgentExports` (`:435-459`, follows reads) → raw `rm(join(root, outputPath), {force:true})` (`:478`) | Deletion must never cross the repository root; classification is not a containment decision | Confirmed; also a classification-to-delete race |
| F-002 | `runAuditCommand` → `auditRepository` (`src/core/audit/index.ts:372-377`) → `mkdir`/`writeFile` for `docs/audit-report.md` and `docs/project-map.md` | Both report writes must be preflighted as a batch; symlink ancestors/final components must be refused | Confirmed; second write can fail after first succeeds |
| F-003 | `ignoreEntriesCheck` (`src/core/doctor/index.ts:172-268`) → `IGNORE_PROBE_FAMILIES` (`:41-95`) → `runCheckIgnore` (`:112-147`) → family loop (`:240-253`) | A safety verdict about path P must be derived from evidence about P, not from a different probe in the same family | Confirmed; real downstream false PASS on translator-agent `architecture/canonical-v3-plan` |

These are direct source re-reads and the previously recorded isolated repros. No new claim is made without evidence.

## Task decisions

| Proposed | Decision | Result | Rationale |
| --- | --- | --- | --- |
| 0290 | Modified | Created (`security`, high, independent review) | Added explicit classification-to-delete race, contained-delete batch helper, batch abort and no-outside-deletion acceptance |
| 0291 | Modified | Created (`security`, high, independent review) | Added both symlink classes, preflight of both paths before any write, no-partial-mutation and docsDirectory decision; removed dependency on 0290 so both can run in parallel |
| 0292 | Modified | Created (`security`, high, independent review) | Every entry probed independently; one bounded git process; re-include proven per exact path; independently constructed Git oracle and negative control required; dogfood correction included |
| 0293 | Modified | Created (`bugfix`, medium, lightweight review via `invariant` tag) | Blocked state handled before review branches; blocker regex matching replaced with structured lifecycle signals; test that encoded the impossible action updated |
| 0294 | Modified | Created (`security`, high, independent review) | General tag/type assurance trigger for diagnostics, authorization, containment, provenance and security verdicts; explicit no-task-specific-special-case criterion; multi-category tests |
| 0295 | Retained | Created (`feature`, medium) | Confirmed downstream provenance friction (F-009), not a release blocker |
| 0296 | Retained and reframed | Created (`refactor`, low) | Measurement-first optimization; no cache without measured benefit and invalidation strategy |
| 0297 | Retained and demoted to P3 | Created (`feature`, low) | Developer-experience improvement; no correctness claim |
| 0298 | Retained | Created (`refactor`, low) | Low-severity packaging hygiene |
| 0299 | Retained | Created (`feature`, low) | CLI/JSON ergonomics; no correctness claim |
| 0300 | Added | Created (`security`, high, independent review) | Justified: 0290/0291 have narrow allowed files and cannot cover all mutation sites; cross-cutting inventory with durable guard |
| 0301 | Added | Created (`security`, high, independent review) | Justified: 0292 covers only ignore semantics and 0300 only mutation sites; independent oracle with negative controls is the only mechanism that breaks circular self-certification |
| — | Rejected | None | No proposed task was unsound; severities of 0296/0297 were reduced rather than tasks rejected |

All 12 tasks were created with `apk task create` using `--lists-json` and `--verification-json`. The CLI auto-added the reserved `build-current` check and `dist/**` where required; no task file was hand-authored.

## Final task graph

| ID | Priority | Depends on | Assurance | Scope summary |
| --- | --- | --- | --- | --- |
| 0290 | **P0** | — | independent | exporters, config-paths, CLI, tests, docs |
| 0291 | **P0** | — | independent | audit, tests, docs |
| 0292 | **P0** | — | independent | doctor, diagnostics, tests, dogfood report |
| 0293 | P1 | — | lightweight | status, attention, CLI tests, docs |
| 0294 | P1 | — | independent | policy, tests, task-system doc |
| 0295 | P2 | — | self-check | task contract, lint, docs |
| 0296 | P2 | — | self-check | status/attention measurement, benchmark harness |
| 0297 | P3 | — | self-check | context selection, CLI, docs |
| 0298 | P3 | — | self-check | package.json, lockfile |
| 0299 | P3 | — | self-check | CLI projections, docs |
| 0300 | P1 | 0290, 0291 | independent | mutation inventory, guard test, architecture doc |
| 0301 | P1 | 0290, 0291, 0292, 0294 | independent | independent oracle suite, negative controls |

## Overlap and risks

- 0290/0291 both touch `src/core/config/paths.ts` contract but only 0290 modifies the helper; 0291 reuses the existing write-batch helper, so no file conflict. They are intentionally dependency-free and parallelizable.
- 0292 and 0301 both touch doctor-adjacent evidence, but 0292 changes doctor implementation while 0301 only adds an external oracle test and forbids editing doctor source.
- 0300 depends on 0290/0291 so its inventory reflects the fixed state; it explicitly reports new gaps instead of fixing them, preventing scope creep.
- 0301 depends on the four safety tasks whose verdicts it validates; its oracle is forbidden from importing APK helpers or using APK review/gate evidence.
- Residual risk: manual repro checks require an operator/recorder; an automated negative control in 0301 partially covers this but does not replace an external reviewer.
- The untracked `.tasks/0285` and `docs/adoption-report.md` WIP was not touched.

## Recommended execution order

1. **0290, 0291, 0292 in parallel** (three independent P0 fixes, each with independent review).
2. **0293 and 0294 in parallel** (P1 lifecycle and assurance fixes).
3. **0300 and 0301 after their prerequisites** (cross-cutting verification; 0301 last among the safety chain).
4. P2/P3 items (0295–0299) in any order; they do not block the next release.

## Sufficiency verdict

The backlog is **sufficient to address all confirmed release blockers** (F-001, F-002, F-003) and the confirmed self-certification weakness (F-005) and impossible-action defect (F-004). No confirmed blocker lacks an owned, bounded, independently reviewed task with negative-path acceptance criteria and a validation command.

Validation performed: `apk lint --json` exit 0 with no findings for any new task; `pnpm test:docs` pass; `apk task policy` confirms review/evidence requirements; `apk task deps` confirms the 0300/0301 prerequisite graph; `apk tasks` and `apk status --detail` show all 12 tasks as `todo` with owner `none`; `apk attention --json` remains unaffected because no task was claimed.

Previous APK gates and the audit report were treated as inputs, not as proof of correctness; the three P0 findings were re-read from source before task creation.
