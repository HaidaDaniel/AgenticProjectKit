# Task 0175 - Restore committed dist currency and prevent source-task dist divergence

State: doing
Owner: codex-0175
Mode: maintenance
Lane: quality
Type: bugfix
Scope: packaging,tasks,ci,tests,docs
Risk: high
Parallel: false
Depends on: none
Tags: bugfix,dist-current,task-policy

## Goal

Restore source-to-package parity on main and add a deterministic task contract that prevents packaged source or packaged asset changes from reaching done with stale committed dist. Correct the public-readiness dependency graph so documentation structure does not wait on blocked Task 0170, while preserving Task 0173's security prerequisite.

## Context files

- AGENTS.md
- docs/project.md
- docs/architecture.md
- docs/task-system.md
- docs/engineering/testing-strategy.md
- docs/decisions.md
- docs/progress.md
- package.json
- .github/workflows/quality.yml
- scripts/copy-template-assets.mjs
- src/core/tasks/index.ts
- src/core/tasks/policy.ts
- src/core/tasks/gate.ts
- src/core/tasks/task.test.ts
- src/core/tasks/package-contract.ts
- src/core/audit/lint.ts
- src/core/audit/lint.test.ts
- src/core/templates/task-templates.ts
- src/core/templates/renderer.test.ts
- src/cli/commands/task.ts
- src/cli/cli.test.ts
- src/core/init/index.ts
- src/core/init/init.test.ts
- src/core/templates/minimal-docs/product-requirements.md.hbs
- .tasks/0151-separate-apk-requirements-from-downstream-project-templates.md
- .tasks/0165-establish-one-canonical-public-cli-name.md
- .tasks/0167-keep-cli-reference-aligned-with-the-command-registry.md
- .tasks/0158-add-a-documentation-home.md
- .tasks/0163-redesign-readme-as-the-public-front-door.md
- .tasks/0168-add-deterministic-documentation-consistency-checks.md
- .tasks/0173-validate-the-next-public-readiness-release.md

## Files allowed to edit

- dist/**
- package.json
- .github/workflows/quality.yml
- scripts/**
- src/core/tasks/*.ts
- src/core/audit/lint.ts
- src/core/audit/lint.test.ts
- src/core/templates/task-templates.ts
- src/core/templates/renderer.test.ts
- src/cli/commands/task.ts
- src/cli/cli.test.ts
- src/core/init/init.test.ts
- docs/engineering/testing-strategy.md
- docs/task-system.md
- docs/decisions.md
- docs/progress.md
- .tasks/0158-add-a-documentation-home.md
- .tasks/0163-redesign-readme-as-the-public-front-door.md
- .tasks/0168-add-deterministic-documentation-consistency-checks.md
- .tasks/0175-restore-committed-dist-currency-and-prevent-source-task-dist-divergence.md

## Files forbidden to edit

- README.md
- pnpm-lock.yaml
- LICENSE
- SECURITY.md
- docs/roadmap.md
- docs/releases/**
- .tasks/archive/**
- .tasks/0151-separate-apk-requirements-from-downstream-project-templates.md
- .tasks/0165-establish-one-canonical-public-cli-name.md
- .tasks/0167-keep-cli-reference-aligned-with-the-command-registry.md
- .tasks/0173-validate-the-next-public-readiness-release.md
- src/core/templates/minimal-docs/**
- .agentic/**

## Steps

1. Preserve the pre-fix reproduction: on the initial clean main checkout, `pnpm build` changed committed `dist/cli/index.js` and `dist/core/init/index.js` and created `dist/cli/command-registry.js` and `dist/core/templates/minimal-docs/product-requirements.md.hbs`. Hosted Quality run 36259623663 failed at `Verify committed dist is current` on exact HEAD `9fe5ebaee28f2002ae68c69a29e06be85460af0c`; its first seven checks passed. Treat this as observed evidence, not an inferred cause.
2. Trace package inputs, task typed templates, verification policy, lint, completion gate, CI, and completed Tasks 0151, 0165, and 0167. Identify the smallest deterministic rule using packaged-source and packaged-asset paths, not a short list of named files.
3. Regenerate committed `dist/**` with the normal build only. Add deterministic source/compiled CLI help parity and generic init/template parity coverage; verify package payload and the compiled entrypoint.
4. Add a reusable contract guard so a task that edits packaged source or copied assets cannot validly complete without a required build-and-dist-current check and permission to commit generated `dist/**`. Detect a source-versus-dist scope contradiction with a clear diagnostic before completion. Docs-only tasks must not acquire build requirements. Cover source edits, rebuilt output, docs-only tasks, forbidden dist scope, and copied `.hbs` assets.
5. Determine applicability from package payload metadata independently of `scripts.build`; derive the command from `packageManager` or exactly one supported lockfile (pnpm, npm, Yarn, or Bun). Missing build scripts or ambiguous/unknown package-manager metadata must block active packaged-source tasks.
6. Keep CI's clean-checkout committed-dist check and make sure it observes copied assets as well as compiled JavaScript. Update the canonical testing/task workflow documentation and ADR if the completion contract changes.
7. Correct only the planning contracts for Tasks 0158, 0163, and 0168: remove their direct dependency on 0170 and make security-page links/checks conditional on `SECURITY.md` being present. Keep 0173's dependency on 0170 unchanged.
8. Commit implementation and generated output, then run all verification against the committed candidate. Obtain a fresh-context read-only review from a separately registered identity, fix any findings, and repeat candidate-bound verification and review as required.
9. Record passing exact-HEAD hosted Quality evidence, complete the APK gate, mark this task done, and commit lifecycle bookkeeping separately.

## Acceptance criteria

- A fresh normal `pnpm build` on the committed candidate leaves no tracked or untracked change under `dist/**`.
- Committed `dist/cli/index.js` imports and dispatches through the current command registry, and `dist/cli/command-registry.js` exists.
- A deterministic regression compares compiled `node dist/cli/index.js --help` byte-for-byte with source CLI help.
- Running compiled `init` in an isolated temporary project emits the generic downstream requirements starter from the copied template; it does not emit the old APK-specific inline starter. Source and copied template parity is covered deterministically.
- A current clean package dry run includes the CLI modules and portable template asset, and the committed package executes the current source behavior.
- Packaged TypeScript source and copied `src/core/templates/**/*.hbs` assets have a deterministic task contract requiring both `dist/**` scope and a required clean-build-plus-dist-current verification. If an actual source/asset edit is attributed to a task whose contract forbids dist or omits that check, lint or the completion gate reports an actionable blocker before the task can complete.
- Package payload detection remains active when a task removes `scripts.build` or changes package metadata while `dist` remains included by a broad `files` glob or `main`/`bin`; the changed source task is blocked with a missing-build-script diagnostic. Malformed payload metadata fails closed. npm-managed fixtures receive an `npm run build` check, while the current pnpm package receives `pnpm build`.
- Regression tests prove stale packaged output blocks, rebuilt and committed output passes, docs-only work does not require build/dist work, source changes with forbidden dist scope are rejected, and a copied template asset receives the same protection as TypeScript source.
- Existing historical states for Tasks 0151, 0165, and 0167 remain `done`; their evidence/history is not rewritten.
- Hosted Quality succeeds on the exact final candidate SHA, including `Verify committed dist is current` and final tracked-drift rejection.
- Task 0158, 0163, and 0168 no longer directly depend on Task 0170. Their security links/checks are conditional on `SECURITY.md` existing. Task 0173 continues to depend on 0170.
- Tasks 0158, 0163, and 0168 are executable without Task 0170; Task 0173 remains blocked until 0170 is done.
- No new dependency, release/tag mutation, README rewrite, roadmap cleanup, rebrand, or change to completed task history is introduced.

## Correctness assumptions

- `src/**/*.ts` files included by the build and `src/core/templates/**/*.hbs` files copied by the asset script define a deterministic package-source surface.
- A task contract can identify packaged paths from its allowed-file patterns without semantic inference.
- Removing generated `dist/**`, running the declared package-manager build command, and checking `git status --porcelain --untracked-files=all --ignored=matching -- dist` is a deterministic proof that committed `dist/**` matches current source and copied assets; the clean build prevents a no-op script from inheriting stale output.
- Tasks 0158, 0163, and 0168 remain otherwise consistent with their inspected contracts.

## Invariants

- `dist/**` is generated from source using the normal build; it is never edited by hand.
- A packaged-source task cannot pass completion without current committed build output.
- A docs-only task has no new build/dist obligation.
- CI checks the exact checkout SHA and rejects tracked drift after checks.
- Task 0173's truthful security-reporting dependency remains mandatory.
- The published `v0.4.7` tag and historical evidence remain untouched.

## Required evidence

- Pre-fix build diff and hosted run/step observation above.
- Candidate-bound results for all automated verification checks, exact-SHA hosted Quality URL and conclusion, independent review result, and APK gate result.
- Compiled/source help parity, compiled init/template parity, package dry-run asset listing, and clean post-build `dist/**` status.
- Test output for all five guard cases and the three dependency corrections.

## Review questions

- Does the package-source path rule cover the whole current build and copied-asset surface without semantic guessing or a general build graph?
- Can an otherwise green task change packaged source, omit or forbid dist, and still reach done?
- Does the proof fail when source or a `.hbs` input changes without regenerated committed output, then pass after build output is committed?
- Do source CLI help and compiled CLI help match deterministically, and does compiled init consume the generic copied starter?
- Can docs-home, README, and docs-consistency work proceed while 0170 is blocked, with security links validated when a policy page exists?

## Counterexample searches

- Change a compiled `.ts` module but leave committed dist untouched.
- Change a copied `.hbs` asset but leave its copied dist file untouched.
- Declare packaged source in allowed paths while omitting `dist/**` or the build-current check.
- Remove `scripts.build` while changing packaged source and confirm package-payload applicability remains true and lint/gate block completion.
- Use `files: ["*"]`, a `main`/`bin` path under `dist`, and malformed package metadata to confirm payload detection cannot be disabled by removing the literal `dist` entry.
- Exercise an npm-managed package and confirm task creation derives `npm run build`; confirm ambiguous or absent manager metadata blocks check derivation.
- Rebuild dist, commit it, and ensure the same guard passes.
- Use a successful no-op build with committed dist and ensure the clean-build guard fails.
- Produce an ignored file under dist and ensure the current-output guard fails.
- Change an `.hbs` file outside `src/core/templates/` and ensure it is not classified as a copied package input.
- Change documentation only and ensure the guard does not request a build.
- Run compiled CLI help and init against temporary directories to detect stale dispatcher or starter behavior.
- Keep SECURITY.md absent while completing Tasks 0158/0163/0168; ensure their checks do not fail solely for that absence, while 0173 still waits for 0170.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"coverage","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test:coverage","artifact":"coverage/coverage-summary.json"}`
- `{"id":"build-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"rm -rf dist && pnpm build && test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"release-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm release:check"}`
- `{"id":"apk-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"apk-sync","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk sync"}`
- `{"id":"package-payload","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"npm pack --dry-run --json"}`
- `{"id":"compiled-help","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js --help"}`
- `{"id":"hosted-quality","type":"manual","required":true,"environment":"ci","profile":"report","instruction":"Observe the hosted Quality run for the exact committed candidate SHA. Confirm the clean-checkout job and Verify committed dist is current and Reject tracked drift from checks both succeed.","evidence":"exact candidate SHA, hosted Quality URL/run id, and successful step conclusions"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`

## Documentation updates

- Update `docs/task-system.md` and `docs/engineering/testing-strategy.md` for the deterministic packaged-source completion contract and its limits.
- Update `docs/decisions.md` if the repository workflow contract changes.
- Update `docs/progress.md` for task lifecycle changes and the corrected public-readiness ordering.
- Update only the dependency and conditional-security wording in Tasks 0158, 0163, and 0168.

## Notes

- Build reproduction was performed before corrective task creation and showed source/dist divergence. Re-run `pnpm build` after claim and inspect the complete generated delta before committing it.
- Do not close Tasks 0151/0165/0167 again or rewrite their history. Repair current main through this new corrective task.
- The next executable public-readiness task after this correction is 0158; continue 0158, 0163, then 0168. Leave 0170 blocked until the operator supplies a private reporting route, preserve 0173's dependency on it, and do not activate 0149/0150.
