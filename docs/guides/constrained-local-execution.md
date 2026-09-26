# Constrained and Local-First Execution

This guide separates APK's repository-local workflow from package acquisition, remote services, and model execution. “Local-first” describes an operating pattern; it is not an air-gap certification or a promise that every task can finish without network access.

## Execution without two paid subscriptions

APK is a deterministic control plane. It reads task and project state, prepares bounded work packages, checks declared policy, records verification and review evidence, and evaluates the completion gate. APK does not run a model or call provider APIs. An external harness runs any model or tools used for implementation and semantic review.

The `local` profile is a complete operating mode: deterministic tools can handle mechanical verification, and a compatible local model/harness can handle suitable planning, implementation, or first-pass review. The `constrained` profile adds scarce frontier capacity for difficult work and escalation. Neither profile requires both a local and a paid frontier subscription. A local model and harness are separate installations and are optional; without one, deterministic tasks can still proceed, while a policy-required semantic role may remain unavailable. APK never lowers required assurance to make a task pass.

Profiles choose resource spending, not task risk or accepted evidence. They do not certify that a given machine can run a particular model. See [resource-aware execution](../execution-profiles.md) for routing and assurance rules.

## Pin and acquire APK while connected

The supported installation model is a repository-local dependency pinned to a release tag, with its resolution recorded in the repository's `pnpm-lock.yaml`. For example, in the downstream repository:

```sh
pnpm add -D git+https://github.com/HaidaDaniel/AgenticProjectKit.git#v0.4.7
```

Commit both `package.json` and `pnpm-lock.yaml`. For a later install from that committed pin:

```sh
pnpm install --frozen-lockfile
pnpm exec apk doctor
```

The frozen install preserves the recorded resolution; it does not promise that a cold install is offline. It may need the Git host for the APK tag and a package registry for uncached dependencies. It can run without network only when the required package sources and dependency artifacts are already available locally through the package-manager store or an approved mirror. If Node, Corepack, or pnpm is not already installed, bootstrapping that toolchain may also require acquisition. Do not replace the repository pin with a global APK binary. The [installation instructions](../../README.md#using-it-in-other-repositories) document the current path; the [distribution research](../research/non-node-apk-installation-and-distribution.md) records why it remains the supported default.

## Which operations stay local?

“No network” below means that the APK command itself does not contact a network service. A task command, Git hook, external harness, or other process it invokes may have its own network behavior.

| Command or operation | Network requirement | Local files and tools | External service or runtime |
| --- | --- | --- | --- |
| `pnpm exec apk status`, `context`, `prompt`, `lint`, `resources detect`, `execution explain`, `quality detect`, `suggest-context` | None initiated by APK. `suggest-context` and some repository views may inspect local Git state. | Reads repository tasks, config, docs, generated files, and available local Git metadata. These commands do not call a model. | None. |
| `pnpm exec apk agent register`, task claim/release/review, `task policy`, `task gate`, and `done` | None initiated by APK. | Reads or writes `.tasks/`, `.agentic/`, and local lock/evidence files; uses local process/Git facts where needed. | The APK state operation needs none. Performing semantic review may use an external harness/model; the gate reports missing external or policy-required results. |
| `pnpm exec apk work ...` or `task dogfood start` | None initiated by APK. | Writes the vendor-neutral work package or dogfood prompt and metadata under `.agentic/`. | An external harness is needed to execute the work or model. Its network use depends on that harness and selected resource. |
| `pnpm exec apk init`, `adopt --apply`, `export`, `sync --write`, `audit`, or `analytics summary --write` | None initiated by APK. | Reads and may create/update repository files or reports. Export and sync use local templates; audit is static inspection. | None. |
| `pnpm exec apk workspaces create|status|cleanup` | No fetch is performed by APK. | Requires local Git for worktree metadata and the repository files; creation or applied cleanup changes local worktree state. A baseline ref must already exist locally. | Local Git executable. A remote is needed only if an operator separately fetches a missing ref. |
| `pnpm exec apk task verify <id>` | Depends on each selected check command. APK itself does not add network access. | Compares local Git changes, executes the task's declared shell command, and records results in `.agentic/evidence.jsonl`. | Whatever the declared command needs: local dependencies, a local service, network access, credentials, or none. Manual/live checks are not executed by the local verifier. Running a command locally does not create hosted-CI evidence. |
| `pnpm exec apk task verify ... --record ...` | No observation is performed by APK; the operator supplies the external result and reference. | Writes a candidate-bound evidence record locally. | The referenced observation may come from a CI run, live service, benchmark, or other external process. APK does not fetch or validate the referenced artifact. |

APK's current source uses local filesystem operations and local Git subprocesses for these workflows; the CLI contains no HTTP client or model/provider runtime. The boundary does not make arbitrary task checks, package-manager operations, hooks, or external harnesses offline-safe. In particular, a declared test/build script may download packages, contact an API, or start/require a service. Inspect the exact command and its dependencies before treating a verification step as local-only.

## Operations that need a network or an external service

| Command or operation | Network requirement | Local files and tools | External service or runtime |
| --- | --- | --- | --- |
| `pnpm add -D git+https://...#<tag>` or a fresh Git-based APK install | Usually needs the Git host and may need package registries for dependencies; caches or approved mirrors can satisfy some or all artifacts. | Writes `package.json`, `pnpm-lock.yaml`, the pnpm store, and `node_modules`. | Reachable Git and package sources, unless every required artifact is already available locally. |
| `pnpm install --frozen-lockfile` | May need configured package sources for anything missing from the local store. Frozen means lockfile-constrained, not offline. | Reads the manifest and lockfile; populates the pnpm store and `node_modules`. | Configured Git/package sources when cache is incomplete. |
| `git clone`, `fetch`, `pull`, or `push` | Requires the selected Git remote to be reachable. | Reads/writes the local working tree and Git database. | Git hosting service and any required credentials. APK worktree commands do not run these operations for you. |
| Hosted CI, such as the maintained [GitHub Actions workflow](../engineering/testing-strategy.md#clean-checkout-ci) | Requires the hosting service and its runner/network access to check out the candidate and acquire dependencies. | The runner checks out a clean repository and runs the configured workflow. | GitHub Actions, Git host, package sources, and any services required by workflow commands. CI is separate from local APK task evidence and the completion gate. |
| Current web research | Requires internet access. | The research notes or resulting repository changes are local once saved. | Browser/search provider or the selected research service. APK does not perform web research. |
| Remote model/harness execution | Requires network access when the selected harness uses a remote endpoint. | APK supplies a local work package and records returned evidence; a local harness may use local workspace files. | The external harness/runtime and, for a hosted model, its provider endpoint and credentials. |

The maintained CI target and package/runtime limits are narrow: v0.4.7 is the latest validated installable release in the policy snapshot; the package declares Node `>=22.22.1`, while maintained validation uses Node `22.22.1`; the repository pins pnpm `10.28.1`; and clean-checkout CI evidence is for GitHub Actions `ubuntu-latest`. Other Node versions, other package managers, macOS and Windows end-to-end installation/release, and registry availability are unverified. See the [compatibility policy](../product/maturity-and-compatibility.md) for the exact evidence and limits.

## Staged use in a constrained or disconnected environment

1. While connected, select the exact release tag, resolve dependencies, and commit the manifest and lockfile. Acquire any locally needed verification tools, package artifacts, model files, and harness/runtime using their own supported distribution paths.
2. Transfer or provision the repository, installed dependencies or complete package-manager cache, Git objects needed by local work, and any local model/runtime inside the environment according to its operator's process.
3. Run repository-local APK commands and checks whose required files, tools, and services are present. Keep checking each task's declared verification command: APK runs it as a shell command, so it can still require a network or local/remote service.
4. Treat remote Git operations, uncached package acquisition, hosted CI, remote model calls, and current web research as unavailable until the environment has an explicitly approved connection or mirror.

An air-gapped run is possible only for the subset whose package artifacts, dependencies, tools, Git objects, model/runtime (if used), and required services are already inside the boundary. This guide does not certify a complete offline install, enumerate every downstream script's network behavior, or claim support for unverified operating systems. If policy requires an independent review or external check that cannot be supplied locally, the gate remains unsatisfied until valid evidence is provided.
