# Backlog reassessment — 2026-10-07

This is development-candidate evidence, not a new release or retroactive task completion. APK lifecycle/evidence records remain authoritative.

## Operator-authorized resolution

After current rechecks and bounded investigation, the operator explicitly selected “+2 вариант”: cancel the mixed historical contracts 0120, 0133, 0191, and 0197, preserve their history, and validate the existing 0120/0191/0197 behavior from a fresh baseline. APK `cancel --owner codex-main-20261007` recorded that choice. Task 0202 performs the combined validation without reimplementing the features. No accept-attribution approval, review pass, or historical done was synthesized. Task 0133 remains canceled: the immutable v0.4.4 release already exists, but post-tag smoke cannot retrospectively establish its missing pre-tag chronology.

## Current historical rechecks

All four canonical rechecks below used HEAD `fa611ca6d908497ede64c82ca51f1983c4373ab7`, after Tasks 0199 and 0198 completed. They stopped on scope before automated checks; this is a failed historical-contract check, not a failed feature test.

| Task | Original baseline | Fresh run | Actual blocker |
| --- | --- | --- | --- |
| 0120 | `327d4ae551117f02664fe674d161a7f5bb95229a` | `verify-1791378254886-l4xl9s` | 297 commits exceed bounded 128-commit proof; forbidden subsequent paths remain visible |
| 0133 | `df5f6c7f4170c473635bbc426da04a9063ceb8ea` | `verify-1791378281562-eplzwl` | 251 commits exceed bounded 128-commit proof; forbidden subsequent paths remain visible |
| 0191 | `5d39fdfe9ab3fcec98355e548ec52efb96dbe0fe` | `verify-1791378204604-0eqdv6` | Legacy release snapshots changed without material-contract hashes; foreign history is outside scope |
| 0197 | `c3f490714fdedcf15f252534ec7f9dac64ab3683` | `verify-1791378158802-wtgv1i` | Legacy release snapshots changed without material-contract hashes; foreign history is outside scope |

0191 now deterministically excludes completed 0194–0196 candidates and new 0198/0199 candidates. 0197 similarly excludes 0198/0199. Remaining rejection is not the repaired direct-candidate diagnostic gap. The current engine intentionally rejects unstable historical material contracts and unresolved ownership.

### Exact obstructing commits and paths

Paths below are the original paths at each historical commit; they are not current navigation links. The table lists the non-proven out-of-scope/forbidden commits in the bounded 0191/0197 investigations. Own in-scope implementation commits are not relabeled foreign. The older 0120/0133 ranges are explicitly over the proof bound and are not silently truncated into successful proofs.

| Task | Exact commit SHA | Blocking paths |
| --- | --- | --- |
| 0191 | `c7ee9c3ec7e77d79ba5963b8dd94d38664b79a8f` | `.github/workflows/quality.yml`, `src/core/tasks/review.ts`, `src/core/tasks/task.test.ts` |
| 0191 | `19e59e3474fce2830431a9b18fe5bd4dc82eef1a` | `docs/engineering/testing-strategy.md`, `docs/research/fast-proportional-verification.md` |
| 0191 | `2732c31e04358eedca823ee2ca2d8cd1c5ba83e6` | `.tasks/0193-make-verification-proportional-and-remove-redundant-quality-runs.md`, `docs/engineering/testing-strategy.md`, `docs/research/fast-proportional-verification.md`, `scripts/check-docs-consistency.test.mjs`, `scripts/test-source.mjs` |
| 0191 | `dbe5173bca448586367e2d12042ff48c90a35cb5` | `src/core/tasks/policy.ts`, `src/core/tasks/task.test.ts` |
| 0191 | `b20b94257af9310a027eda7577bc82acbf0acedb` | `.tasks/0193-make-verification-proportional-and-remove-redundant-quality-runs.md` |
| 0191 | `37de8dab786ac0716219ea5d7752004fa928ff87` | `.tasks/0194-move-cli-behavior-matrices-to-isolated-command-layer-tests.md` |
| 0191 | `edc02fac9c7eb0c749316d57c59d0e1140033ec7` | `.tasks/0195-prove-completed-multi-commit-task-chains-in-stale-baseline-scope-exclusion.md` |
| 0191 | `398d925ed360534a1bbd4337499571d360e49fdf` | `src/core/tasks/evidence.ts`, `src/core/tasks/gate.ts`, `src/core/tasks/index.ts`, `src/core/tasks/review.ts`, `src/core/tasks/task.test.ts` |
| 0191 | `ac8454ea8c828bf5b5cb88343bfa5b99526e90c4` | `src/core/tasks/evidence.ts`, `src/core/tasks/index.ts`, `src/core/tasks/task.test.ts` |
| 0191 | `7a659aa3e5ff852dfe9177e0afed6f3e01a3a1fe` | `src/core/tasks/index.ts`, `src/core/tasks/task.test.ts` |
| 0191 | `08586eb65ace7f679cd57b6259b8d38e739be65e` | `.tasks/0197-add-explicit-operator-approved-attribution-recovery-for-interrupted-tasks.md` |
| 0191 | `582e07e90f1e9ec5c278ff6d4112748ae8a2059f` | `src/core/tasks/review.ts`, `src/core/tasks/task.test.ts` |
| 0191 | `bb2a4fc4b5b6dfeef1e4cb8b04417be9b228e8b7` | `src/core/tasks/index.ts`, `src/core/tasks/task.test.ts` |
| 0191 | `30cd9a542485a266bdfa3867aaa041bffe24f7c1` | `src/core/tasks/index.ts` |
| 0191 | `8fd48628925e8ae2fa602a78a641ca5d0fe4d0a2` | `src/core/tasks/index.ts`, `src/core/tasks/task.test.ts`, `src/core/tasks/workflow.ts` |
| 0191 | `ecb576d24fb72c882fed28697b015552257daa1d` | `.tasks/0197-add-explicit-operator-approved-attribution-recovery-for-interrupted-tasks.md` |
| 0191 | `e5ad1e4c149af9c0df06730b08a1eaad02487049` | `src/core/tasks/index.ts`, `src/core/tasks/task.test.ts` |
| 0191 | `002360c2f14f8a3e10c8347f49b5ac7cf6f2dcaa` | `.tasks/0197-add-explicit-operator-approved-attribution-recovery-for-interrupted-tasks.md` |
| 0191 | `5836af541ccea9e29e6f9cb4ebe2caaf7b44f3fb` | `.tasks/0198-document-safe-same-checkout-task-switching-in-generated-agent-instructions.md` |
| 0197 | `b209924cfe482fba9b7c4eee351b53a64cf497f5` | `src/core/skills/index.ts` |
| 0197 | `af1d0cbf7d82076bb6b243104c969046ed6ee8bd` | `src/core/skills/index.ts` |
| 0197 | `4194c1e1aff733a2f364b51d9be29bd4c616b311` | `src/core/skills/index.ts` |
| 0197 | `403d661beb43b1122fd30fee762b85d383d4bd7b` | `src/core/skills/index.ts` |
| 0197 | `e7f2d8e92f7b4fa2fc6821da62775eca2a6921d6` | `.tasks/0191-materialize-apk-skills-into-standards-based-project-skill-directories.md` |
| 0197 | `ef140c6913a029d0fbfbef51f19100d10c5f03d5` | `.tasks/0191-materialize-apk-skills-into-standards-based-project-skill-directories.md` |
| 0197 | `ad8fe9a2ce184026d4810b23db081f9205719ade` | `src/core/skills/index.ts`, `src/core/skills/skills.test.ts` |
| 0197 | `5e5bad8737688fcef1d4a3eba5a1783f80559e57` | `src/core/skills/index.ts` |
| 0197 | `4af239b24460d3cc088edb1d2532cf871b7ccede` | `src/core/skills/index.ts`, `src/core/skills/skills.test.ts` |
| 0197 | `ecb576d24fb72c882fed28697b015552257daa1d` | `.tasks/0191-materialize-apk-skills-into-standards-based-project-skill-directories.md` |
| 0197 | `5836af541ccea9e29e6f9cb4ebe2caaf7b44f3fb` | `.tasks/0198-document-safe-same-checkout-task-switching-in-generated-agent-instructions.md` |

Task 0193 temporarily expanded its allowed files/steps in `2732c31e04358eedca823ee2ca2d8cd1c5ba83e6` and allowed/context scope in `dbe5173bca448586367e2d12042ff48c90a35cb5` while implementing those paths. Its exact completion evidence cannot establish a stable material contract across that chain. Closeouts `b20b94257af9310a027eda7577bc82acbf0acedb` and `37de8dab786ac0716219ea5d7752004fa928ff87` changed docs/progress alongside task Markdown, so they are not task-file-only bookkeeping proofs.

Five existing 0191 attribution decisions are stale; no current decision exists for 0197. Reapproving the growing history would be false: 0191 own `0415c979ace20088d63a77828659c23347f26c2e` shares docs/task-system.md with foreign 0193 work; 0197 own implementation also shares that path with foreign skill corrections. Exact approved/unapproved same-path semantics reject this mixture. Cancellation was explicitly authorized as a different resolution, not as attribution approval.

## Fresh validation of existing behavior

Focused source checks on fresh Task 0202 baseline `3951560d89c01965fb09bf704dbbc0ea3352d667` passed:

- Eighteen lifecycle/attribution regressions: bounded UTF-8 full reason storage and concise display, legacy reasons, authoritative active ownership, direct/chain legacy ambiguity, released intervals, competing claim rejection, contract laundering, exact SHA approval, later unapproved same-path commit, transient forbidden create/delete, partial lists, operator self-authorization, side branches, forged evidence, and human decision boundaries.
- All eight skill materialization tests: preview/create/no-op, customization conflict/force, spaces, source equivalence, parent/final redirect refusal, hardlink refusal, temporary replacement and rollback, and portable Windows/path fallback. Windows cases simulate the platform on Linux; actual Windows kernel execution is not claimed. The documented hostile concurrent namespace limitation is retained.
- Canonical final Task 0202 verification runs `pnpm release:check`, which composes `pnpm quality:static`, all source/CLI/task coverage tests, build, lint, sync drift, and audit; separate declared checks cover dist currency and `git diff --check`. Actual candidate-bound results and independent review are recorded in APK evidence after the candidate commit.

## Independent technical release subset

Source commit: `040440f4c488c840d5556aa8bb86f989346d95f7`; tree: `58e3a078d2088d57cd7d8774668f60a46c0b69c9`. A shared Git clone was frozen at that commit, packed outside the checkout, and installed in a fresh consumer with a fresh pnpm store. Package version was 0.4.7; tarball SHA-256 was `a9b7ca563be7e7500cdce0392b05e93ec75abd9945822beacfa6b81692eb4841`.

All three bins (`apkit`, `apk`, `agentic-project-kit`) and six bundled skill assets were present and executable/readable. Installed skill create/no-op produced rendered SKILL.md without template placeholders. A Go downstream fixture passed non-mutating adoption preview, apply, sync, lint, doctor, status, and audit while preserving its original main.go. Disposable APK self-adoption preserved every original tracked source byte; the only new files were an adoption task and docs/adoption-report.md.

The observed technical subset passed. No version/tag publication, new release, actual-tag post-release cold install, or Go application build is claimed. It does not complete Task 0173, whose contract explicitly depends on completed Task 0170. Exact final-HEAD hosted Quality is a separate final verification requirement, not inferred from this earlier smoke.

## Reporting route and remaining dependencies

The actual operator decision is GitHub Private Vulnerability Reporting, with no separate security email, SLA, bounty, deadlines, or fabricated contact. The operator reported a private repository; read-only GitHub public API instead returned `private: false`, while the public security page offered no `Report a vulnerability`. Neither observation establishes externally verified PVR. No visibility/settings mutation or SECURITY.md availability claim was made.

Required sequence: make the repository public if necessary → enable PVR → verify `Report a vulnerability` as an external non-maintainer → claim/reverify 0170 → write truthful SECURITY.md and minimal navigation → verify/review/gate/done 0170 → finish dependent 0173 release validation. The proposed future sanitized `apk report` dogfood feature is separate and was not implemented.

| Remaining task | Current blocker | Required human/operator action |
| --- | --- | --- |
| 0149 | Deferred identity research requires explicit activation | Decide whether to reopen product-name selection |
| 0150 | No approved new product identity | Approve a specific name and rebrand scope |
| 0170 | Real PVR unavailable/unverified externally | Establish publication state, enable PVR, verify as external reporter |
| 0173 | Explicit dependency on completed 0170; publication/post-tag portion pending | Complete the reporting prerequisite before dependent release validation |

## Canonical archival

Task 0201 corrected proof loss across canonical archival. Task 0202 uses `apk task archive --all --preview` then `--apply`, checks terminal byte preservation, and retains contracts protected by literal references in fixtures, current contexts, or immutable history. ID-based dependencies remain resolvable. Archive moves belong to this maintenance candidate, not to the earlier completed features.

The applied archive pass moved exactly eight contracts: 0185, 0192, 0196, 0197, 0198, 0199, 0200, and 0201. SHA-256 checks against the preview-time bytes all passed. Literal-reference-protected terminal contracts were retained; no active or blocked task was archived.
