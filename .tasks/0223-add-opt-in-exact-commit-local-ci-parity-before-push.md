# Task 0223 - Add opt-in exact-commit local CI parity before push

State: todo
Owner: none
Mode: maintenance
Lane: workflow
Type: feature
Scope: ci,push,git,worktree,toolchain,verification
Risk: high
Parallel: false
Depends on: 0219,0220,0222,0224
Tags: ci,push,toolchain,git,verification

## Goal

Provide an explicit opt-in local guard that runs a repository-declared CI contract against the exact commit tips being pushed, in isolated clean checkouts. Keep fast commit feedback and hosted CI as separate proof boundaries, and give a precise failure reason and recovery instruction when local parity cannot complete.

## Context files

- AGENTS.md
- docs/architecture.md
- docs/decisions.md
- docs/engineering/testing-strategy.md
- docs/task-system.md
- docs/cli-commands.md
- scripts/check-docs-consistency.mjs
- .husky/pre-commit
- .husky/pre-push
- .github/workflows/quality.yml
- package.json
- .tasks/archive/0192-make-pre-push-feedback-fast-while-preserving-full-ci-quality.md
- .tasks/0219-preserve-verification-process-termination-reasons.md
- .tasks/0220-reject-misleading-noncanonical-task-scope-patterns.md
- .tasks/0221-add-explicit-audited-task-contract-amendments.md
- .tasks/0222-align-workspace-candidate-freshness-regression-with-content-identity.md

## Files allowed to edit

- .husky/pre-push
- src/cli/command-registry.ts
- src/cli/commands/ci-parity.ts
- src/cli/commands/ci-parity.test.ts
- src/cli/command.test.ts
- src/cli/cli.test.ts
- src/core/ci-parity/**
- dist/cli/command-registry.js
- dist/cli/commands/ci-parity.js
- dist/core/ci-parity/**
- dist/**
- apk-ci-parity.json
- apk-ci-parity.example.json
- docs/ci-parity.md
- docs/cli-commands.md
- docs/decisions.md
- docs/progress.md

## Files forbidden to edit

- .tasks/archive/**
- package.json
- pnpm-lock.yaml
- .github/**
- .agentic/**
- docs/releases/**

## Steps

1. Reproduce the current local-versus-hosted gap from the exact pushed commit contract. Keep the known Task 0222 test failure separate; do not fold its fixture correction into this task.
2. Use `apk-ci-parity.json` at the repository root as the one canonical, tracked runtime config; keep `apk-ci-parity.example.json` as a non-executed example. Validate exact host tool versions, frozen dependency-install argv, required local-safe check argv, per-check timeouts, expected CI contract files, and explicit hosted-only checks. The runtime config and every referenced tracked script are repository-owned executable code: state this trust boundary in CLI help and docs, require operators to inspect and trust the exact pushed revision before enabling `APK_CI_PARITY=1`, and fail closed when config or references are untracked, missing, or invalid. Execute argv arrays without a shell; do not imply that argv execution or a detached worktree makes untrusted code safe, and never infer an application's runtime from APK's own Node runtime.
3. Add an explicit `apk ci-parity` command and gate the APK pre-push integration behind `APK_CI_PARITY=1`. With the variable unset, preserve the current fast pre-push behavior exactly. Do not install, replace, or rewrite downstream Git hooks; document the manual opt-in snippet for a repository owner. Register the command and its options in the canonical CLI registry, test dispatch and public help, keep the generated command-reference block in `docs/cli-commands.md` aligned, and run `node scripts/check-docs-consistency.mjs` in the existing full verification aggregate.
4. Parse Git pre-push ref input. For every updated ref, validate the exact local tip SHA in a new detached temporary worktree; ignore ref deletions, handle new refs, and deduplicate identical tip SHAs. For a single ref containing multiple new commits, test its pushed tip once, matching the hosted push event subject rather than claiming that every intermediate commit was separately tested.
5. Fail closed on a dirty caller worktree, unavailable required tool/version, missing tracked contract file, frozen install failure, toolchain/CI-contract mismatch, missing required result, nonzero exit, timeout, signal, cancellation, or leftover tracked/untracked build drift. Report the exact ref/SHA, check, observed termination reason, and actionable next command without guessing unknown process outcomes.
6. Run only declared local-safe commands in the isolated worktree, with a bounded environment allowlist that excludes inherited secrets by default. Never run LLM/API, paid, deployment, production-dependent, or otherwise hosted-only checks; if a required check is hosted-only, report parity as incomplete and fail with an instruction to use hosted CI or obtain explicit authorization through a separately designed workflow.
7. Do not persist or reuse a successful parity result. Every opt-in push reruns the required checks for its exact tip and current contract; dependency-manager caches may only accelerate installation and must not stand in for check execution.
8. Preserve the existing pre-commit fast lane. Keep `apk lint` static: lint must validate task/config contracts without spawning declared commands or CI scripts.
9. Add deterministic fake-repository and fake-process tests for every failure boundary below, including concurrent invocations and explicit rejection of unsupported host platforms. Do not use live providers, external secrets, deployment, production services, or wall-clock sleeps for category coverage. State the tested/supported platform set; fail closed with a precise diagnostic outside it.
10. Document the APK branch-protection observation and operator action: local hooks are bypassable; `main` currently has no active branch protection/ruleset, so require pull requests and the hosted `Clean-checkout quality` status check through repository rules before calling main protected. Do not change GitHub settings in this task or call local parity a hosted pass.
11. Add reference command-contract examples for Node/pnpm, Python/uv-or-locked-pip, and Go repositories. Use each host repository's own frozen install and aggregate verification commands. Record translator-agent and resledger as observed examples; make no adoption claim for inaccessible RigOps or InfoWarden-internal checkouts.
12. Run the one canonical full `pnpm release:check`, verify the isolated output leaves committed `dist/` current and the caller tree unchanged, then review the complete candidate.
13. Record measured cold and warm parity durations, plus which setup/check stages are included, in `docs/ci-parity.md`.

## Acceptance criteria

- The ordinary pre-commit fast lane is unchanged. The APK pre-push hook runs its existing fast checks by default and invokes full parity only after the explicit `APK_CI_PARITY=1` opt-in and a valid contract are present.
- No command is inferred from or executed directly out of arbitrary GitHub Actions YAML. The contract explicitly lists host-native argv, frozen dependency setup, pinned tool versions, required checks, timeouts, and the CI contract files it represents.
- `apk-ci-parity.json` is the sole canonical tracked runtime config; the example file is never used as an implicit fallback. Config and referenced scripts are treated as repository-owned executable code, and the opt-in warning explains that operators must inspect/trust the exact revision before execution.
- All local checks run in a disposable detached worktree for the exact pushed local SHA, with no writes to the caller's checkout. A local pass prints the exact SHA and contract/toolchain identity and is labeled local-only, never GitHub Actions evidence.
- Pre-push ref handling covers multiple updated refs, new refs, deletion refs, repeated SHAs, and a branch push containing multiple commits. It never substitutes current `HEAD` for a different pushed tip and never treats intermediate commits as separate hosted push events.
- Missing tracked check/config file, stale tracked `dist`, missing frozen dependency, unavailable or mismatched Node/pnpm/Python/uv/Go version, dirty worktree, and incomplete required checks each fail closed with a specific diagnostic and recovery instruction.
- Nonzero exit, timeout, signal termination, spawn failure, and cancellation remain distinct. Unknown outcomes remain unknown; timeout is based on trustworthy timeout metadata, not a signal or `killed` flag alone. Do not change `DEFAULT_TASK_COMMAND_TIMEOUT_MS` or task verification/gate/freshness behavior.
- Concurrent parity runs use isolated unique worktrees and cannot share or overwrite a pass result. A changed SHA, contract file, tool version, or lockfile always causes fresh check execution; no pass cache exists.
- A required hosted-only/secrets/paid/deploy/production check is never run implicitly. Its presence makes local parity incomplete and reports which hosted check remains outstanding.
- The `apk ci-parity` route is registered once, appears in public help and the canonical `docs/cli-commands.md` reference, and passes the existing registry/help plus docs-consistency checks.
- Python and Go fixtures run only their declared repository-native commands and do not require Node as the application runtime. Node is used only when the APK tooling itself is invoked or the host contract declares it.
- The supported host-platform matrix is explicit and covered by deterministic tests; unsupported hosts fail closed instead of silently skipping parity.
- Git hook setup never overwrites downstream hooks. Documentation explains that `--no-verify` and `core.hooksPath` can bypass native hooks, and that required hosted status checks plus PR-only/restricted updates are the enforcement boundary for `main`.
- GitHub repository settings remain untouched; documentation does not claim branch protection was enabled.
- `apk lint` remains non-executing, fake-command tests prove no shell command runs from lint, and `pnpm release:check` passes once with clean committed `dist/`.
- `docs/ci-parity.md` records observed cold and warm parity durations and states whether each includes dependency setup.

## Correctness assumptions

- A host repository can declare an authoritative local-safe verification contract that is reviewed when its CI workflow, tool versions, or lockfiles change.
- Git push hooks expose updated ref tips, but are advisory and bypassable; GitHub rules are required for remote enforcement.
- CI-only checks may not be reproducible locally and must remain explicitly outstanding rather than silently skipped.

## Invariants

- Opt-in parity never becomes a claim of hosted CI success.
- The exact pushed tip SHA is always the local check subject; no result is reused for a different SHA or contract.
- The caller's index/worktree, task evidence, release tags, and remote refs are not modified by the parity runner.
- No secrets are inherited or printed by default, and no live/paid/deployment/production check runs without explicit authorization.
- Hook success is not an absolute security guarantee; required branch rules remain the separate remote control.
- Full CI work is not duplicated by launching nested aggregates or re-running successful checks within one parity invocation.

## Required evidence

- Exact-commit local parity result with the host command, tool versions, frozen lockfile identity, CI-contract fingerprint, SHA, duration, and local-only label.
- Deterministic regression output for every required negative case and for clean isolated execution.
- Evidence that the default fast hook is unchanged and explicit opt-in invokes the aggregate once.
- Evidence that no success result is persisted/reused and that concurrent calls have isolated worktrees/results.
- Documentation of observed branch protection/ruleset state and required operator action, without changing GitHub settings.

## Review questions

- Can a pushed ref point to a different SHA than the one checked, including when multiple refs or multiple commits are pushed?
- Can stale config, workflow/toolchain/lockfile changes, or a previous local pass let a required check be skipped?
- Can a timeout, signal, cancellation, or spawn error be mislabeled as success or as a different failure class?
- Can a dirty checkout, missing tracked file, stale `dist`, or absent frozen dependency evade the clean-checkout result?
- Can a check marked hosted-only reach a secret, LLM/API, paid service, deployment, or production dependency without explicit authorization?
- Can a repository-owned config or referenced script execute untrusted code when an operator enables the hook, or can the warning be mistaken for a sandbox guarantee?
- Does the command appear exactly once in the registry, dispatch/help output, and canonical CLI docs, with the docs consistency check covering the reference?
- Does a ref shape or host platform outside the implemented MVP fail closed without substituting `HEAD`, skipping a pushed SHA, or using a dirty checkout?
- Does any lint/preflight path execute a shell command or workflow step?
- Does setup replace a customized hook or imply that an unbypassable local guarantee exists?
- Does the documented main-branch control require an actual hosted status check and restrict direct updates, rather than relying on a local hook?

## Counterexample searches

- Clean checkout is missing a tracked script/config/fixture required by the declared CI contract.
- Source changes while committed `dist/` remains stale; build creates tracked drift or unexpected untracked output.
- Frozen install fails because a locked dependency is unavailable or lockfile and manifest differ.
- Local Node/pnpm/Python/uv/Go differs from the pinned CI version while local fast checks would otherwise pass.
- Required command exits nonzero, times out, is signaled, fails to spawn, is canceled, or returns an ambiguous runner error.
- Two concurrent pushes target the same branch with different SHAs; the older local result must never authorize the newer tip.
- A single push sends several new commits on one ref, multiple refs with different tips, duplicate tips, a new branch, or a deleted ref.
- Caller tree has staged, unstaged, or untracked files before parity starts.
- A required check needs a CI-only secret or live LLM/API, paid service, deployment, or production dependency.
- A repository-owned config or referenced script is changed in an untrusted branch and the opt-in is enabled without inspecting the exact pushed revision.
- CI workflow, expected CI contract file, tool pin, or lockfile changes after a previously successful local invocation.
- A multi-ref push contains one supported and one unsupported ref shape; the runner must check every exact tip or reject the whole invocation before allowing push.
- A push runs on an OS outside the declared supported matrix; parity must fail with the unsupported-platform diagnostic.
- Hook invocation uses `--no-verify` or `core.hooksPath`; report the local guard's bypassability and verify the hosted branch-rule recommendation remains necessary.
- `apk lint` encounters an executable command in task/config text; verify it reports statically without starting that command.

## Verification

- `{"id":"release-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm release:check"}`
- `{"id":"dist-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"test -z \"$(git status --porcelain --untracked-files=all --ignored=matching -- dist)\""}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
- `{"id":"parity-timing-report","type":"automated","required":true,"environment":"local","profile":"report","command":"grep -q 'Observed cold and warm parity durations' docs/ci-parity.md"}`

## Documentation updates

- Document configuration, exact-SHA behavior, supported host-native command contracts, opt-in usage, failure diagnostics, known limitations, and branch-protection requirements in docs/ci-parity.md.
- Record the architectural boundary between local parity and hosted CI in docs/decisions.md.
- Update docs/progress.md when task state changes.

## Notes

- Task 0192 is done and intentionally made the default hook fast while leaving full CI authoritative. This task adds an explicit opt-in path and does not reverse that default.
- Task 0177 previously ran stronger pre-push checks; Task 0192 deliberately removed the full release aggregate. This task is distinct because it runs the exact pushed SHA in an isolated worktree only after explicit opt-in.
- This task depends on 0219 and 0220 because those contracts currently forbid `src/cli/**` and share generated `dist/**`; it depends on 0221 because that active task owns `src/cli/command-registry.ts` and `dist/**`; it depends on 0222 because the current full release aggregate has a reproduced failing test. Keep those dependencies unless the referenced contracts are completed or the actual path overlap is removed.
- Task 0221 was blocked because its original baseline includes foreign Task 0222/0223 contract commits. Task 0224 is its bounded successor for the remaining epoch identity paths; 0223 depends on 0224 while the shared packaged output work is completed in sequence.
- Keep multi-ref exact-SHA handling and detached clean-checkout validation in this MVP: silently postponing multi-ref support would let a push contain an unchecked ref. Cross-platform expansion can be deferred because it is not needed to establish the exact-SHA invariant; define the initial tested platform set and fail closed elsewhere, then create a separate follow-up only if downstream evidence requires broader support.
- Current public main CI run 39127552538 for `e012972780ccd93be4678338b7f05061d8a5ff22` failed at `pnpm release:check`; the public annotation reports only exit code 1 and the job-log endpoint returned 403. A clean exact-SHA replay with Node 22.22.1 and pnpm 10.28.1 passed frozen install and failed 631/632 tests at `src/cli/cli.test.ts:1235`, where a README-only commit leaves content-based `candidateId` unchanged. This is a confirmed local failure at the current red SHA, not a claim about inaccessible hosted log details. The earlier `cc58a39` replay exhibited the same assertion. The local fast pre-push passed on `cc58a39`, showing the full aggregate was absent from the fast lane.
- Current public API observation for APK `main`: `protected=false` and no active rulesets. No branch settings are changed by this task; require an operator to configure PR-only or restricted main updates and the hosted `Clean-checkout quality` required status check.
- Downstream inspection found the translator-agent pre-push omits `python -m pytest`, while its CI runs that suite; resledger's pre-push `scripts/verify-push.sh` omits several checks in `scripts/verify-release.sh --full --ci`. Local checkouts for RigOps and InfoWarden-internal were unavailable, so no behavior is asserted for them.
- Do not run the local parity command from APK lint, audit, or task contract validation. Only an explicitly invoked hook/command may execute repository-declared checks.
- Last observed hosted success (run 37671164276) spent 146 seconds in the clean-checkout quality job and 202 seconds from workflow start to completion, including queue/setup. Capture fresh local cold and warm measurements before claiming local parity cost; hosted duration is context, not a local runtime guarantee.
- Config trust is an operator boundary, not a sandbox: opt-in means executing repository-owned commands from the exact pushed commit. Never auto-enable parity for a downstream repository and never imply that a clean worktree, environment filtering, or argv-only spawning makes untrusted repository code safe.
