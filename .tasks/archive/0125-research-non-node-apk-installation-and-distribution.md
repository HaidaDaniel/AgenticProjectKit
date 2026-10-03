# Task 0125 - Research APK installation and distribution for non-Node repositories

State: done
Owner: user
Mode: discovery
Lane: architecture
Type: docs
Scope: installation,distribution,packaging,scanners,adoption,dogfood
Risk: medium
Parallel: false
Depends on: 0056,0110,0112,0118
Tags: research,design,distribution,non-node,dogfood

## Goal

Produce an ADR-quality research recommendation for how AgenticProjectKit should be installed, pinned, discovered, and invoked in repositories whose application stack does not use Node.js, including Python, Go, Rust, .NET, and other ecosystems where applicable. This is a research/design task only. Do not implement a new installation model, change package layout, change APK installation behavior, migrate downstream repositories, or preselect a preferred solution.

The research is motivated by real downstream dogfood rather than a hypothetical portability concern:

- `HaidaDaniel/translator-agent` is a Python runtime repository with `pyproject.toml` and Python lock/dependency evidence, while its root `package.json` explicitly exists as development-only APK tooling and pins `agentic-project-kit` from Git tag `v0.4.2`; root `pnpm-lock.yaml` is consequently also tracked.
- `HaidaDaniel/resledger` is a Go application with `go.mod`, while its root `package.json`/pnpm setup provides APK tooling pinned to `v0.4.3` and development scripts. The Node package metadata must not by itself be interpreted as evidence that the application runtime is Node.
- Task 0112 corrected Python/Go omission by adding canonical runtime markers but intentionally left Node/pnpm detection unchanged, so mixed evidence is currently reported rather than semantically distinguishing APK-owned tooling from the application stack.
- Task 0122 documents a related readiness failure mode where `package.json` is an invalid proxy for repository semantics in a Go + APK-tooling repository.

The core question is whether the current root `package.json` + pnpm model is the cheapest reliable project-local pinning mechanism and only needs better semantics, or whether non-Node repositories need an isolated or different supported distribution path.

### Current architecture to trace before comparing alternatives

Trace the current behavior end-to-end instead of reasoning from filenames alone. At minimum inspect:

- APK `package.json`, `pnpm-lock.yaml`, package `bin` entries, committed `dist/`, and Node engine/package-manager requirements;
- install-from-Git/tag behavior and the guarantees established by v0.4.2 and v0.4.3, including committed runnable `dist`, no install-time build requirement, exact-tag/cold-install expectations, and project-local CLI usage;
- `apk init`, `apk adopt`, `apk audit`, `apk doctor`, `apk lint`, `apk context`, `apk work`, and `apk task ...` invocation assumptions;
- generated agent instructions and the task 0056 decision to prefer repo-local `pnpm exec apk` over an unpinned global binary;
- config discovery and executable discovery assumptions;
- stack, quality, and repository-readiness scanners and the corrective work in tasks 0077, 0091, 0112, 0122, and related dogfood fixes;
- task 0110 packaging/release guarantees and task 0118 v0.4.3 cold-install/release guarantees;
- `translator-agent` and `resledger` as read-only downstream evidence. Do not modify either repository.

### Architectural invariant to test independently from distribution

Evaluate and either adopt or reject this invariant explicitly:

**The presence of APK-owned tooling must never, by itself, imply the presence of a Node application stack.**

Determine whether making that invariant explicit in scanner/config/docs semantics fully solves the practical dogfood problem while keeping the current installation architecture. Do not assume distribution must change merely because root Node metadata is aesthetically undesirable.

### Options that must be compared

Evaluate every practically viable option below against the same criteria. An option may be rejected early when a concrete technical constraint makes it non-viable, but record the reason and evidence.

A. **Keep current root package manifest + pnpm model.** Preserve project-local Git/tag pinning and classify the APK manifest as tooling-only through explicit semantics, scanner rules, generated guidance, and documentation. Determine whether this is sufficient and how tooling ownership can be identified without hiding legitimate mixed Node application repositories.

B. **Isolate repository-local Node tooling.** Evaluate a bounded directory such as `.agentic/`, `.tools/`, or another justified location containing its own package manifest and lockfile plus a short root launcher/wrapper. Do not select a directory in advance. Preserve project-local reproducible pinning and simple agent commands.

C. **Globally installed APK CLI + repository-local version/config marker.** Evaluate exact-version enforcement, version drift, clean-machine setup, and simultaneous repositories requiring different APK versions.

D. **Package-manager-independent launcher/wrapper.** Evaluate a small stable launcher that resolves and executes the repository-pinned APK without forcing agents/users to know installation paths. Do not design a second package manager or updater unless evidence shows the complexity is justified.

E. **npm/pnpm package use without a root package manifest.** Determine whether exact project-local installation/pinning can be done reasonably without tracked root `package.json`/lockfile, and what reproducibility or ergonomics are lost.

F. **Standalone executable / bundled Node runtime / SEA or comparable distributable.** Evaluate Linux, Windows, and macOS; binary/package size; executable provenance; Git/tag distribution; offline install; upgrade behavior; platform/architecture matrix; signing/notarization burden; CI/release complexity; and ongoing APK maintenance cost.

G. **Other practical distribution mechanisms.** Consider only mechanisms that could realistically be simpler or materially better, such as npm global/corepack-like execution, `npx`/`pnpm dlx` with an exact version, direct Git checkout/tool cache, containerized execution, mise/asdf/devbox/Nix-style tool management, or thin language-native wrapper packages. Reject exotic approaches that add ecosystem burden without a clear benefit.

The research must finish with exactly one recommendation category:

1. **KEEP CURRENT MODEL** - root Node tooling remains the supported/default model because alternatives are worse; enumerate the concrete scanner/docs/config improvements needed for an honest tooling-only distinction.
2. **ISOLATE TOOLING** - recommend a repository-local isolated Node tooling layout and provide a migration/design contract without implementing it.
3. **NEW DISTRIBUTION MODEL** - recommend standalone/global/wrapper distribution only if its benefits materially exceed release and maintenance complexity.
4. **HYBRID** - for example, retain the current Node-native path for Node repositories while supporting a different bounded path for non-Node repositories.

## Context files

- AGENTS.md
- README.md
- package.json
- pnpm-lock.yaml
- dist/cli/index.js
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/decisions.md
- docs/task-system.md
- docs/cli-commands.md
- docs/adoption-flow.md
- docs/agent-exporters.md
- docs/engineering/scanner-system.md
- docs/releases/v0.4.2.md
- .agentic/config.json
- .tasks/0056-use-repo-local-apk-in-agent-instructions.md
- .tasks/0077-add-repository-quality-capability-detection-and-policy-contracts.md
- .tasks/0091-correct-task-0077-quality-detector-review-findings.md
- .tasks/0110-make-git-tag-distribution-self-contained-and-prepare-v042.md
- .tasks/0112-detect-pyproject-based-python-repositories-during-adoption.md
- .tasks/0113-harden-generated-workflow-docs-against-invalid-apk-cli-examples.md
- .tasks/0118-release-v043-corrective-dogfood-fixes.md
- .tasks/0122-align-repository-readiness-test-findings-with-detected-test-capability.md
- src/core/scanners/index.ts
- src/core/quality/index.ts
- src/core/audit/index.ts
- src/core/audit/lint.ts
- src/core/init/index.ts
- src/core/docs/adopt.ts
- src/core/config/file.ts
- src/core/config/index.ts
- src/core/exporters/index.ts
- src/core/templates/exporters/agents.md.hbs
- src/core/agents/index.ts
- src/core/work/index.ts
- src/core/tasks/index.ts
- src/cli/commands/init.ts
- src/cli/commands/adopt.ts
- src/cli/commands/audit.ts
- src/cli/commands/doctor.ts
- src/cli/commands/context.ts
- src/cli/commands/work.ts
- src/cli/commands/task.ts

## Files allowed to edit

- .tasks/0125-research-non-node-apk-installation-and-distribution.md
- docs/research/non-node-apk-installation-and-distribution.md
- docs/decisions.md
- docs/progress.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- dist/**
- src/**
- scripts/**
- .github/**
- .agentic/**
- AGENTS.md
- CLAUDE.md
- GEMINI.md
- .codex/**
- .opencode/**
- .cursor/**

## Steps

1. Establish the current installation/distribution baseline from APK source, docs, release tasks, v0.4.2/v0.4.3 evidence, and package metadata. Record what is guaranteed today versus what is merely convention.
2. Inspect `translator-agent` and `resledger` read-only as concrete dogfood cases. Record which root files exist only or primarily for APK/control-plane tooling, what application-runtime markers exist, how agents invoke APK, and which scanner/readiness results have already required corrections.
3. Trace stack/quality/readiness detection, generated instructions, config discovery, and executable discovery. Separate two questions: "how APK is installed" and "what repository semantics APK/tooling files imply". Test whether the tooling-only scanner invariant can solve the practical problem without distribution changes.
4. Compare options A-G using one explicit matrix. For each viable option evaluate repository semantics, reproducibility, agent usability, upgrade behavior, cross-platform behavior, security/supply-chain exposure, APK maintenance cost, downstream migration, and monorepo behavior. Include package/binary size and release/signing burden where relevant.
5. For reproducibility, explicitly evaluate exact tag/version/SHA pinning, clean-machine/cold install, offline/cache behavior, deterministic resolution, and multiple repositories using different APK versions concurrently. Distinguish "easy first install" from "reproducible project-local install".
6. For agent usability, demonstrate the intended stable command shape for Codex/OpenCode/Pi/local agents for `apk doctor`, `apk lint`, `apk context`, `apk work`, and `apk task ...`. Reject designs that require agents to discover transient install paths or emit long unstable commands for normal work.
7. For upgrades, show which tracked files change when APK is bumped, whether lockfile churn occurs, how an agent-driven migration would work, and how an interrupted/partial migration is recovered. Existing APK-adopted repositories must remain valid unless a user explicitly migrates them.
8. For cross-platform/security analysis, cover Windows PowerShell, Linux shell, macOS, path quoting, executable shims, install scripts, Git dependency behavior, package-manager scripts, downloaded binary provenance, and any signing/notarization implications. Do not claim security improvement merely by moving the same trust boundary elsewhere.
9. Estimate initial implementation complexity and ongoing maintenance cost for each surviving option using a consistent scale, and call out any option that effectively creates a second package manager, installer, updater, binary release pipeline, or per-language support matrix.
10. Write `docs/research/non-node-apk-installation-and-distribution.md` as the research artifact. It must contain evidence, comparison matrix, recommendation, rejected alternatives, compatibility/migration analysis, and unresolved risks. Update `docs/decisions.md` only with the final recommendation/decision reference; do not alter runtime/package behavior.
11. End with exactly one of KEEP CURRENT MODEL / ISOLATE TOOLING / NEW DISTRIBUTION MODEL / HYBRID. State the recommended default, the minimum non-breaking improvements possible immediately, the minimum migration path if change is recommended, and the follow-up backlog tasks that would be needed. List proposed follow-up tasks in the artifact only; do not create implementation tasks as part of this research task.
12. Run documentation/task-contract verification. The final diff for this task must contain research/decision/progress/task-state artifacts only and no implementation or downstream changes.

## Acceptance criteria

- The research artifact is ADR-quality, evidence-backed, and scoped specifically to non-Node installation/distribution and scanner semantics rather than a general APK re-review.
- `translator-agent` and `resledger` are used as explicit read-only dogfood evidence, with their Python/Go application markers and APK-owned root Node tooling distinguished accurately.
- Current APK packaging and install guarantees are described from the actual v0.4.2/v0.4.3 contracts: committed runnable `dist`, Git/tag installation, cold-install expectations, package `bin`, Node/pnpm requirements, and repo-local invocation behavior.
- `apk init`, `apk adopt`, `apk audit`, scanner behavior, generated instructions, config discovery, and executable discovery are traced far enough to identify which assumptions each candidate distribution model would change.
- The artifact evaluates the invariant "APK-owned tooling alone must never imply a Node application stack" and explicitly states whether that invariant plus scanner/docs changes is sufficient without changing installation architecture.
- Options A-F are evaluated. Option G includes only additional mechanisms with a credible practical advantage; exotic options are explicitly omitted or rejected rather than padded into the matrix.
- One comparison matrix scores or characterizes every surviving option using the same dimensions: root pollution/application semantics, tracked files, tooling/application dependency separation, monorepo behavior, exact pinning, cold/offline behavior, concurrent per-repo versions, agent command ergonomics, upgrade/lockfile churn, Windows/Linux/macOS behavior, supply-chain exposure, downstream migration, implementation complexity, and ongoing APK maintenance cost.
- The current root `package.json` + pnpm model is treated as a valid candidate, not as a presumed defect. The recommendation is allowed to be KEEP CURRENT MODEL when its simplicity/reliability wins.
- Any isolated-tooling proposal specifies a bounded layout contract, launcher contract, version-pin ownership, lockfile ownership, monorepo behavior, and migration compatibility without committing to a directory name before comparison justifies it.
- Any global/launcher model explains how exact repository versions are enforced, how two repositories can use different APK versions simultaneously, and how agents avoid global-version drift.
- Any standalone/binary model includes Linux/Windows/macOS and architecture coverage, expected package-size implications, bundled-runtime implications, release CI matrix, provenance/signing/notarization burden, Git/offline install, upgrades, and long-term maintenance cost.
- `npx`/`pnpm dlx`, direct Git cache, containers, mise/asdf/devbox/Nix, and language-native wrappers are accepted or rejected for concrete reproducibility/ergonomics/maintenance reasons rather than preference.
- The research demonstrates a short stable invocation path for Codex/OpenCode/Pi/local agents for doctor, lint, context, work, and task commands under the recommended model.
- Existing downstream repositories remain supported. No recommendation requires automatic mass rewriting of `translator-agent`, `resledger`, or other adopted repositories.
- Backwards compatibility identifies what remains valid unchanged, what can be introduced without a breaking change, and what would require an explicit opt-in migration or major-version contract.
- The recommendation includes a minimal migration path and rollback/recovery story if repository layout or distribution changes are proposed.
- The final recommendation is exactly one of KEEP CURRENT MODEL, ISOLATE TOOLING, NEW DISTRIBUTION MODEL, or HYBRID, with a clear default and reasons tied to evidence and maintenance cost.
- Rejected alternatives are documented with concrete reasons, not merely lower preference scores.
- Estimated implementation complexity and ongoing maintenance burden are stated for the recommended model and serious alternatives.
- If change is recommended, the artifact lists the minimum new backlog tasks needed after the decision, ordered by dependency and compatibility risk. Those implementation tasks are not created by this research task.
- If KEEP CURRENT MODEL is recommended, the artifact instead lists the concrete scanner/docs/config/generated-instruction improvements needed to preserve an honest tooling-only distinction and identifies which are already covered by existing tasks such as 0112/0122.
- No source, package layout, lockfile, committed dist, generated agent instruction, installation behavior, or downstream repository is changed while performing this task.

## Correctness assumptions

- APK remains a Node/TypeScript CLI during this research; changing implementation language is outside scope.
- v0.4.2 established self-contained Git-tag distribution with committed `dist` and no install-time build requirement; v0.4.3 retained the cold-install/release evidence model.
- Project-local pinning is currently a deliberate property because generated guidance was corrected in task 0056 to avoid depending on an arbitrary global `apk` binary.
- `package.json` can represent application dependencies, development/control-plane tooling, or both; filename presence alone is insufficient to establish ownership semantics.
- A non-Node application repository may legitimately contain some Node development tooling, so the research must not solve the problem by globally ignoring `package.json` whenever Python/Go/Rust/.NET markers exist.

## Invariants

- This task produces research and a decision recommendation only; it does not implement or migrate an installation architecture.
- APK tooling presence alone does not become application-stack truth by policy fiat; ownership/semantics must be evidence-backed.
- Existing v0.4.2/v0.4.3 consumers remain valid during research and are not automatically rewritten.
- No second package manager, updater, installer service, binary release matrix, or per-language wrapper ecosystem is recommended without a material measured benefit over current complexity.
- Agent-facing APK invocation remains short, stable, repository-contextual, and compatible with project-local version control under the recommended design.
- Reproducibility and maintenance cost are decision criteria at least as important as aesthetic root cleanliness.
- `translator-agent`, `resledger`, and all other downstream repositories are read-only evidence for this task.
- Proposed follow-up implementation tasks are listed only after the research recommendation and are not created automatically.

## Required evidence

- A current-state trace linking package metadata, `bin`, committed `dist`, Git/tag installation, generated repo-local invocation, config/executable discovery, and v0.4.2/v0.4.3 release guarantees.
- Read-only dogfood evidence from `translator-agent` and `resledger`, including the exact application markers and APK tooling manifests/pins relevant to the problem.
- A scanner interaction trace covering stack, quality, and readiness behavior plus tasks 0112 and 0122.
- One normalized option comparison matrix with cited technical constraints and maintenance-cost estimates.
- Cross-platform and supply-chain notes for every recommended/surviving distribution path.
- A final recommendation section containing exactly one allowed outcome label and a backward-compatible migration/non-migration contract.

## Review questions

- Does the evidence show a real installation defect, or mainly a repository-semantics/scanner classification defect?
- Can the tooling-only invariant solve the downstream problem while preserving the current cheap/reproducible install path?
- Does the recommended model still let two repositories pin and run different APK versions without human path management?
- Can Codex/OpenCode/Pi/local agents invoke APK predictably from repository instructions on Windows, Linux, and macOS?
- Does any proposed simplification merely move complexity from pnpm into a custom launcher/cache/updater maintained by APK?
- Are application dependencies and APK tooling dependencies distinguishable to scanners and third-party tooling under the recommended model?
- What tracked files change for a normal APK upgrade, and is that churn justified?
- Can existing repositories continue unchanged until an explicit migration is chosen?
- Are standalone/binary benefits large enough to justify release-matrix, provenance, signing, size, and bundled-runtime costs?
- Is the recommendation based on current APK constraints and dogfood evidence rather than aesthetic preference?

## Counterexample searches

- A real Node application that also uses APK: tooling-only classification must not hide its Node runtime.
- A Python/Go/Rust/.NET monorepo with a legitimate Node frontend package plus APK tooling.
- Two adjacent repositories pinned to different APK versions and used by the same agent/session.
- Fresh machine with no warm pnpm/npm cache.
- Offline machine with only previously cached dependencies/artifacts.
- Windows path containing spaces and PowerShell invocation through generated instructions.
- Global APK version newer or older than the repository-required version.
- Git tag/SHA unavailable or moved versus immutable package/binary artifacts.
- Interrupted upgrade that changes a version marker but not the resolved executable/cache.
- Package manifest containing both APK and genuine Node development/application dependencies.
- Monorepo where root tooling ownership differs from package/workspace application ownership.

## Verification

- `{"id":"task-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"diff-check","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"git diff --check"}`
- `{"id":"research-completeness","type":"manual","required":true,"environment":"local","profile":"report","instruction":"Review docs/research/non-node-apk-installation-and-distribution.md against every Acceptance criteria item and confirm the artifact contains the normalized matrix, dogfood evidence, scanner invariant analysis, cross-platform/security/maintenance analysis, one allowed final recommendation label, backwards compatibility, and minimal migration/non-migration path.","evidence":"research artifact path plus review checklist result"}`
- `{"id":"no-implementation-diff","type":"manual","required":true,"environment":"local","profile":"trusted","instruction":"Inspect the final diff and confirm it contains only this task state plus research/decision/progress documentation. Confirm package.json, pnpm-lock.yaml, dist/**, src/**, generated instructions, installation layout/behavior, and downstream repositories are unchanged.","evidence":"final changed-file list and confirmation"}`

## Documentation updates

- docs/research/non-node-apk-installation-and-distribution.md
- docs/decisions.md
- docs/progress.md

## Notes

- This task is deliberately a decision gate, not an implementation container. Do not prototype by committing wrappers, alternate manifests, installers, binaries, or package-layout changes to this repository.
- Disposable external experiments are allowed only when they are necessary to verify feasibility or cross-platform/package-manager behavior; keep their results as evidence and do not commit experimental infrastructure.
- Do not re-review APK generally. Reuse existing architecture, release, scanner, and dogfood evidence and investigate only installation/distribution semantics for non-Node downstream repositories.
- Task 0112 fixed missing Python/Go runtime evidence but intentionally preserved Node/pnpm detection. Task 0122 is related open corrective work about readiness semantics and should be considered, not duplicated or made a dependency of this research.
- Do not create follow-up implementation tasks before this research reaches a recommendation. The artifact may list proposed task titles/scopes so a human can create them after accepting the decision.
- Research outcome (2026-09-14): `docs/research/non-node-apk-installation-and-distribution.md` records the accepted `KEEP CURRENT MODEL` conclusion. Repository-local exact pinning remains the default; APK should separate application/runtime semantics from APK/dev-tooling semantics instead of introducing a second installer/distribution model. No runtime/package/downstream implementation change was made by this research closure.
