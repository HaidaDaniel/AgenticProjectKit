# Non-Node APK installation and distribution research

Status: accepted research conclusion
Task: 0125
Date: 2026-09-14

## Decision

**Recommendation category: KEEP CURRENT MODEL**

Keep the current repository-local `package.json` + pnpm installation model as the supported default for AgenticProjectKit, including non-Node application repositories. The current model already provides the properties that matter most for agentic development: repository-local version control, exact Git tag/version pinning, a lockfile, short stable commands, concurrent repositories using different APK versions, and no custom APK installer/updater/runtime.

The real downstream defect is not that a Python or Go repository contains Node tooling. The defect is treating APK-owned Node tooling as evidence about the application runtime. APK must distinguish application/runtime evidence from development/control-plane tooling evidence. The invariant accepted by this research is:

> APK-owned tooling must never, by itself, imply that the application stack is Node.js.

Task 0112 already fixed the most damaging form of this problem by adding canonical Python and Go runtime markers instead of allowing `package.json` to hide those runtimes. Task 0122 covers a related readiness error where a root Node manifest was used as a proxy for test layout. The remaining architectural improvement is semantic classification, not a new distribution mechanism.

## Evidence

### Current APK package/distribution contract

At v0.4.3, AgenticProjectKit is a Node/TypeScript CLI with:

- Node requirement `>=22.22.1`;
- pnpm as the development/package-manager contract;
- package `bin` aliases `apk`, `apkit`, and `agentic-project-kit`, all targeting `dist/cli/index.js`;
- committed runnable `dist/` included in the package payload;
- no install-time build requirement for downstream Git-tag consumers;
- Git/tag installation used by downstream repositories;
- repository-local invocation intentionally preferred over a global binary.

Task 0110 established the self-contained Git-tag model for v0.4.2: committed `dist`, no `prepare`/install build hook, fresh-store install verification, and executable CLI directly from the installed package. v0.4.3 retained that release discipline. Task 0056 intentionally changed generated guidance to use the project-local APK rather than an arbitrary global installation.

This means the current model is not accidental root pollution. It is the mechanism by which the repository owns the APK version that its agents execute.

### `translator-agent`: Python application, APK Node tooling

`HaidaDaniel/translator-agent` is a Python runtime project:

- `pyproject.toml` declares project `novel-harness`, Python `>=3.12`, Python dependencies, Python CLI entrypoint, pytest and Ruff configuration;
- its root `package.json` is explicitly named/described as development-only APK tooling;
- that manifest pins `agentic-project-kit` from Git tag `v0.4.2`;
- therefore a root pnpm lockfile exists even though the application runtime does not depend on Node or APK.

This is direct evidence that a root `package.json` can be a control-plane/tooling manifest rather than application-stack evidence.

### `resledger`: Go application, APK/tooling Node manifest

`HaidaDaniel/resledger` is a Go application:

- `go.mod` is the canonical application/runtime marker;
- the root `package.json` pins APK v0.4.3 and also exposes convenience scripts that execute Go quality/build commands;
- the manifest therefore represents repository tooling and command composition, not proof that the application itself is a Node service.

ResLedger also demonstrates that "tooling-only" is not necessarily equivalent to "contains only APK". A root Node manifest can host APK plus small development wrappers while the application remains Go. Therefore ownership must not be inferred solely from the dependency list or from the existence of `package.json`.

### Scanner/readiness evidence

Task 0112 corrected the earlier failure mode where Python and Go were omitted when APK tooling existed at the root. It deliberately preserved Node/pnpm detection and made mixed evidence visible. That was the correct bounded bugfix: an evidenced runtime must not disappear merely because another toolchain is present.

Task 0122 documents the next semantic issue: readiness must not infer a universal Node-style test-directory model from `package.json`, especially for Go repositories with package-local `*_test.go` tests. This reinforces the same architectural lesson: package/tooling evidence and application capability evidence are separate dimensions.

## Separate the two problems

### Problem 1: how APK is installed

The current mechanism is strong:

1. repository tracks the APK dependency and exact Git tag/version in `package.json`;
2. pnpm resolves it and records the resolution in `pnpm-lock.yaml`;
3. the installed package already contains runnable `dist`;
4. generated instructions invoke the repository-local executable through pnpm;
5. two repositories can use different APK versions concurrently without global path/version management.

No current dogfood evidence shows that this mechanism is unreliable enough to justify replacing it.

### Problem 2: what APK/tooling files mean about the application

The current flat stack/readiness view can over-interpret a Node manifest. This is the part that should evolve.

A repository can simultaneously contain:

- application runtimes: Python, Go, Rust, .NET, Node, or multiple application components;
- development tooling: APK, formatters, code generators, frontend build helpers, documentation tooling;
- package managers used only for those tools.

APK should report those roles honestly rather than forcing every detected marker into one undifferentiated "application stack" bucket.

## Option comparison

Complexity and maintenance use a relative 1-5 scale, where 1 is the current/simple path and 5 is a second distribution product.

| Option | Root semantics | Exact per-repo pin | Two repos / different APK versions | Cold install | Offline after cache | Agent command | Win/Linux/macOS | Upgrade churn | Supply-chain surface | Initial complexity | Ongoing maintenance | Conclusion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | --- |
| A. Current root manifest + pnpm | Root tooling files visible; semantics need classification | Strong: manifest + lock + tag | Strong | Proven by release process | Good with pnpm/Git cache | Short: `pnpm exec apk ...` | Existing pnpm/Node shims | manifest + lock | Existing npm/Git trust boundary | 1 | 1 | **Choose** |
| B. Isolated repo-local Node tooling | Cleaner root, but hidden tooling ownership moves under subdir | Strong if subdir has manifest + lock | Strong | Similar to A | Similar to A | Needs cwd logic or wrapper | Wrapper must be portable | subdir manifest + lock + wrapper | Same trust boundary plus wrapper | 3 | 3 | Reject for now |
| C. Global APK + repo marker | Clean root dependency layout | Weak unless custom version resolver enforces marker | Risk of drift/collision | Easy first install, weaker reproducibility | Depends on global cache | Short only when global state matches repo | Installation/path differences | marker plus global update | Global mutable executable | 3 | 3 | Reject |
| D. Package-manager-independent launcher | Can hide package-manager details | Potentially strong | Potentially strong | Requires custom resolver/cache | Custom cache required | Excellent after launcher exists | Launcher distribution becomes product | custom metadata/cache | New downloader/resolver trust path | 4 | 4 | Reject |
| E. npm/pnpm execution without tracked root manifest | Cleaner tracked root | Weaker without lockfile/project dependency | Possible but cumbersome | Network/cache resolution on demand | Cache-dependent | `pnpm dlx`/`npx` style | Tool-specific behavior | little tracked churn | Registry/Git resolution every invocation/setup | 2 | 2-3 | Reject |
| F. Standalone executable / bundled Node | No Node package metadata downstream | Strong if binary version pinned | Strong if repo wrapper selects artifact | Requires platform artifact download | Good if artifact cached | Very short | Needs OS/arch matrix | binary/version marker | Binary provenance/signing channel | 5 | 5 | Reject |
| G1. Exact `pnpm dlx` / `npx` | No persistent dependency required | Exact version possible, lockless | Yes | Re-resolves acquisition | Cache-dependent | Moderate | Cross-platform package-manager behavior | no lock update | repeated acquisition/resolution path | 2 | 2 | Reject as default |
| G2. Direct Git checkout/tool cache | Root can stay clean | Strong with immutable SHA | Yes | Custom bootstrap required | Good after cache | Needs resolver/wrapper | Path/shell handling burden | custom cache metadata | Git + custom cache ownership | 4 | 4 | Reject |
| G3. Containerized APK | Host stack isolated | Strong image digest possible | Yes | Heavy first pull | Good if image cached | Awkward for repo-local filesystem/Git | Docker/runtime dependency | image pin | container registry/runtime | 4 | 4 | Reject |
| G4. mise/asdf/devbox/Nix | Can be reproducible | Strong inside that ecosystem | Yes | Depends on extra tool | Often good | Extra prerequisite | Cross-platform uneven | tool config | another tool manager | 3 | 3-4 | Optional external choice, not APK default |
| G5. Language-native wrappers | Looks native per ecosystem | Can be strong | Yes | per-ecosystem install | per-ecosystem | good locally | many package systems | wrapper + APK version | multiplied package supply chains | 5 | 5 | Reject |

## Why not isolate tooling now

An isolated `.agentic`/`.tools`-style Node package is the strongest alternative, but it does not remove the Node requirement. It moves it. To preserve the current agent ergonomics, APK would then need at least one of:

- generated commands with an explicit subdirectory/cwd;
- a cross-platform root launcher;
- package-manager workspace configuration;
- executable discovery logic that knows the isolated install path.

That adds migration and command-discovery complexity while keeping essentially the same pnpm/Git supply-chain boundary and the same version/lockfile model. The measurable benefit is mostly root aesthetics and reduced accidental third-party interpretation of `package.json`. APK can address its own interpretation directly at much lower cost.

Isolation remains a reasonable future opt-in if downstream tooling outside APK proves that root manifests themselves cause material problems. Current evidence does not reach that threshold.

## Why not global or on-demand execution

A globally installed APK is operationally convenient but weakens the repository-first invariant. A repository can declare one workflow contract while an agent accidentally executes another APK version from `PATH`.

`npx`, `pnpm dlx`, or equivalent exact-version commands avoid some global drift, but they remove the lockfile/project dependency that currently makes the installed executable part of the repository's reproducible toolchain. They also make normal commands longer or require another wrapper.

These mechanisms are useful for bootstrap or experimentation, not as the canonical post-adoption workflow.

## Why not a standalone binary

A standalone binary would remove Node/pnpm from consumers, but APK would inherit:

- OS and CPU architecture release matrices;
- bundled runtime size and compatibility work;
- binary provenance and checksums;
- signing/notarization expectations, especially Windows/macOS;
- separate GitHub release/download/cache behavior;
- another install/upgrade path to test and document;
- executable discovery and rollback semantics across artifact versions.

That is disproportionate to the demonstrated problem. Current Git-tag packaging already solved the important installation failure: consumers do not need to build APK during installation.

## Recommended semantic model

The current flat marker inventory should evolve conceptually toward two related views:

1. **application/runtime evidence** - canonical host application markers and components;
2. **tooling/control-plane evidence** - APK and other repository-development tools.

This does not mean suppressing Node whenever Python/Go/Rust/.NET exists. A real Node application or frontend in a mixed monorepo must remain visible.

### Ownership rules

Do not decide ownership from `package.json` presence alone.

Preferred evidence order:

1. explicit repository configuration/ownership metadata when available;
2. canonical application markers and workspace/component boundaries;
3. manifest content and known APK dependency/pinning evidence as supporting information;
4. conservative "mixed/unknown" when ownership cannot be proven.

A future explicit marker may be warranted if automatic classification remains ambiguous. It should annotate manifest/tooling role; it should not introduce another installation mechanism.

## Minimum non-breaking improvements

The distribution stays unchanged. Follow-up implementation should be limited to semantics and guidance:

1. **Distinguish runtime/application stack from tooling stack in scanner/project-map output.** A root Node tooling manifest must not make a Python/Go repository appear to be a Node application.
2. **Preserve legitimate mixed repositories.** Python/Go plus a real Node frontend must report both application components; do not globally suppress Node when another runtime marker exists.
3. **Use explicit ownership where inference is ambiguous.** Prefer a small optional config/metadata role over increasingly clever heuristics.
4. **Align audit/readiness with detected capabilities rather than Node layout assumptions.** Task 0122 already owns the concrete test-readiness contradiction.
5. **Document the root manifest as repository tooling for non-Node adoption.** Generated/adoption guidance should explain that APK's Node requirement is a development/control-plane requirement, not necessarily an application runtime requirement.
6. **Keep repo-local invocation canonical.** Continue using the repository-pinned executable. Do not silently fall back to an arbitrary global `apk`.
7. **Keep upgrade changes bounded.** A normal APK version bump changes the tooling pin/resolution (`package.json`, `pnpm-lock.yaml`) plus only canonical generated/migration artifacts that actually changed.

Task 0112 already implements canonical Python/Go marker detection. Task 0122 is the existing corrective backlog for capability-vs-layout readiness. Those tasks should not be duplicated by distribution work.

## Agent command contract

Under the recommended model, Codex, OpenCode, Pi, and local agents should continue to use one stable repository-local shape:

```sh
pnpm exec apk doctor
pnpm exec apk lint --json
pnpm exec apk context <task-id> --level 2 --budget <units>
pnpm exec apk work <task-id> --owner <agent-id> --target <target>
pnpm exec apk task verify <task-id> --owner <agent-id>
```

The important contract is repository-local resolution, not pnpm specifically as a permanent product identity. If APK later supports another distribution mechanism, the generated instructions may abstract this behind a stable launcher, but current evidence does not justify adding that launcher now.

## Cross-platform notes

### Windows

The current package-manager executable shim is preferable to a shell-script-only launcher. Generated commands should remain compatible with PowerShell and paths containing spaces. Avoid adding Bash-only wrappers as the canonical path.

### Linux/macOS

The existing Node/pnpm execution model is straightforward. Git-tag acquisition and package-manager cache behavior remain the main external dependencies.

### Offline/cache behavior

No option provides a magical offline first install. The current model works offline only when the required Git/package artifacts are already available in local caches/stores. A standalone binary would have the same first-acquisition problem in a different artifact channel.

## Supply-chain/security conclusion

Moving APK under another directory does not change the trust boundary. Global install, custom launcher/download, and standalone binaries add new mutable or artifact-distribution boundaries.

The current model has a comparatively small security surface:

- pin the APK Git tag/SHA/version;
- record dependency resolution in the lockfile;
- ship committed runnable `dist`;
- avoid install-time build hooks;
- execute the repository-local package.

Future hardening should focus on immutable release provenance and version verification rather than replacing pnpm solely to remove root files.

## Upgrade and recovery contract

A normal tooling upgrade should be agent-driven and bounded:

1. inspect current manifest pin, lock resolution, installed APK identity, repository state, and release notes;
2. update the exact APK pin and lockfile reproducibly;
3. run applicable adoption/compatibility and generated-file sync through canonical ownership rules;
4. run APK doctor/lint/audit plus host-project checks;
5. inspect final diff and task/evidence freshness;
6. commit tooling changes separately when the repository's workflow calls for it.

If acquisition or verification fails, do not partially reinterpret the application stack, reset task history, or force a global APK version. Restore or keep the previous manifest/lock state and report the unresolved migration.

The detailed agent-driven upgrade design is owned by Task 0126.

## Backward compatibility

Existing v0.4.2/v0.4.3 downstream repositories remain valid unchanged.

No mass rewrite of `translator-agent`, `resledger`, or other repositories is required. Semantic scanner/reporting improvements can be introduced compatibly. If an explicit tooling-role marker is later added, absence of that marker must remain supported and resolve conservatively.

Changing the physical tooling layout should be an explicit opt-in migration only if future evidence justifies it. It is not part of this decision.

## Rejected alternatives summary

- **ISOLATE TOOLING**: viable but not sufficiently beneficial today; adds path/launcher/migration complexity without removing Node/pnpm or changing the trust boundary.
- **GLOBAL CLI**: violates reliable project-local version ownership and makes simultaneous versioned repositories harder.
- **PACKAGE-MANAGER-INDEPENDENT LAUNCHER**: useful only if APK is prepared to own resolver/cache/update behavior; premature now.
- **LOCKLESS `npx`/`pnpm dlx` DEFAULT**: simpler bootstrap, weaker repository-local reproducibility and normal-command ergonomics.
- **STANDALONE BINARY**: disproportionate release/platform/signing/maintenance burden for the demonstrated problem.
- **CONTAINER DEFAULT**: heavy filesystem/runtime dependency for a repository-local CLI.
- **LANGUAGE-NATIVE WRAPPERS**: multiplies package ecosystems and long-term maintenance.

## Unresolved risks

- Third-party tools may still interpret any root `package.json` as a Node project even after APK fixes its own semantics. If this becomes a material downstream problem, isolated tooling should be re-evaluated with measured evidence.
- Rust/.NET and complex monorepos need the same application-vs-tooling distinction even though current corrective detection focused on Python/Go.
- Exact Git tag pinning assumes trustworthy immutable release practice; release provenance remains important.
- Root package scripts can mix APK control-plane commands and host-project quality commands, so ownership cannot be inferred by a simplistic "APK-only dependency" heuristic.

## Proposed follow-up backlog, not created by this task

1. Add a bounded application-vs-tooling classification contract to scanner/project-map/audit output, preserving mixed stacks and using explicit metadata when needed.
2. Update adoption/generated documentation to describe APK's Node/pnpm requirement as repository tooling when the host application is non-Node.
3. Complete the existing Task 0122 readiness-capability correction rather than creating a duplicate.
4. Add dogfood fixtures for Python + APK tooling, Go + APK tooling, and mixed host + genuine Node application component before considering isolated tooling.

No distribution implementation task is justified by this research.

## Final recommendation

KEEP CURRENT MODEL
