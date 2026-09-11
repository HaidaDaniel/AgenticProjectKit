# Roadmap

## v0.1

- TypeScript CLI scaffold.
- Project config generation.
- `init`, `adopt`, `mode`, `next-task`, `context`, `prompt`, and `export`.
- Minimal templates.
- Basic exporters for the core agent files.
- Task file generation.

## v0.2

- Better repository scanning.
- `apk audit` report generation.
- Better validation of config and task files through audit.
- Stronger context selection.
- Better prompt generation.

## v0.3

- `apk sync` check and write workflow.
- Improved adoption and audit flows.
- Better mode-aware behavior.
- More template coverage.
- Stronger CLI tests.
- More polished task orchestration.

## Future

- Web UI.
- SaaS support.
- Cloud sync.
- Integrations with issue trackers.
- Multi-repo workflows.

## Excluded from v0.2 and v0.3

- Web UI.
- SaaS backend.
- Cloud sync.
- Issue tracker sync.
- Database and authentication.

## Next gated-workflow release (planned)

Tasks 0057-0081 preserve repository-first, model-agnostic control-plane direction. `done` becomes evidence-backed completion; external coding harnesses remain workers. All implementation prerequisites are complete; 0075 is done and validated candidate `5f65faa` against gated workflow plus hosted clean-checkout CI.

| Milestone | Tasks | Capability |
| --- | --- | --- |
| 1 - Meaningful Done | 0057, 0058, 0059, 0060, 0061, 0063, 0062 | Revision-bound evidence, verification, scope, policy, independent review capability, then completion enforcement |
| 1 - Reliability / Foundation | 0076, 0080 | Safe stale-lock recovery plus bounded Task 0073 P2 reliability fixes; both required before final release |
| 2 - Independent Correctness | 0064-0066 | Assumptions/invariants, typed guardrails, built-in consistency lint |
| 3 - Efficient Agent Workflow | 0067-0071 | Budgeted context, change-aware suggestions, dogfood evidence, provenance, explainable status |
| 4 - Harness Interoperability | 0072-0073 | Worker contract, implement/review/fix composition |
| 5 - Upgrade, Quality and Release | 0074, 0077-0079, 0075 | Safe v0.3.1 adoption, vendor-neutral capability policy, APK-local guardrails, clean-checkout CI and candidate-specific validation |

Task links and direct dependency graph: [delivery milestones](delivery/milestones.md#next-gated-workflow-release-planned).

Bootstrap: 0063 depends on 0058,0061; 0062 depends on 0059,0060,0061,0063. Pre-release chain: 0073 -> 0074 -> 0077 -> 0078 -> 0079. Tasks 0076 and 0080 are independent graph branches but must be serialized where files overlap. 0075 requires all branches. Evidence freshness is mandatory; stale history remains visible but cannot close tasks. Release lifecycle: prepare -> freeze exact candidate -> non-mutating validation -> evidence; changed candidate requires new freeze/revalidation.

Quality boundary: APK detects stable capability IDs, evaluates explicit repository policy and recommends missing optional capability. APK-local ESLint/hooks/coverage/GitHub tooling never becomes an automatic adopted-repository dependency. Hooks = feedback, APK verify/gate = task proof, CI = clean-checkout proof, 0075 = frozen-candidate proof.

This backlog excludes model runtime ownership, RAG/vector storage, cloud/UI/SaaS work, autonomous swarms and remote execution. Earlier future ideas remain separate.

## Resource-Aware Execution (next coherent milestone)

Resource-Aware Execution follows the gated-workflow foundation and precedes any further expansion of automatic multi-agent orchestration. The accepted architecture is documented in [execution profiles](execution-profiles.md); Task 0082 records the documentation/backlog pass, and Tasks 0083-0088 implement it.

| Order | Task | Priority | Capability |
| --- | --- | --- | --- |
| Plan | 0082 | complete before implementation | Architecture and implementation-ready contracts |
| A | 0083 | P0 | Vendor-neutral model, harness, and executable worker/resource registry |
| B | 0084 | P0 | `executionProfile` and deterministic resource-aware role routing |
| C | 0085 | P0 | Adaptive assurance levels, trigger escalation, deterministic-first review, and budgets |
| D | 0086 | high | Deterministic detection plus validated vendor-neutral workflow calibration/explain |
| E | 0087 | later | Worker/resource occupancy and bounded human attention status |
| F | 0088 | later | Optional safe isolated Git workspaces for parallel top-level workers |

Direct implementation graph:

```text
0072 + 0074 + 0082 -> 0083 -> 0084 -> 0085
                                          |----> 0086 (+ 0077)
                                          `----> 0087 (+ 0070, 0071) -> 0088
                                                                           (+ 0070, 0073, 0084)
```

Tasks 0077-0079 remain an independent quality/release chain and do not wait for resource-aware execution. After 0085, Tasks 0086 and 0087 can proceed independently: 0086 also waits for 0077 to reuse its deterministic repository quality-capability inventory, while 0087 does not wait for calibration. Task 0075 is not retroactively made dependent on this later milestone.

The milestone retains the existing independent-review capability while making its use risk-, trigger-, resource-, and budget-aware. In particular, a constrained medium-risk task does not automatically require a second frontier run. Deterministic checks run before semantic review, and required but unavailable assurance remains an explicit gate/attention state.

This milestone does not implement an LLM runtime, provider SDK layer, secret manager, autonomous swarm, always-on master LLM, cloud control plane, dashboard/SaaS, remote execution platform, billing system, or generic scheduler.

## Exporter consolidation (done)

Task 0092 makes `AGENTS.md` the only full common-policy generated export and reduces other harness files to direct consumption or minimal native adapters. Codex, OpenCode, and Cursor read `AGENTS.md` directly; `CLAUDE.md` and `GEMINI.md` are thin `@AGENTS.md` imports; obsolete `.codex/instructions.md`, `.opencode/AGENTS.md`, and `.cursor/rules/*.mdc` files have a conservative report/cleanup migration path. It depends on completed exporter, sync, contract-lint, adoption-compatibility and generated-policy foundations (`0029`, `0040`, `0066`, `0074`, `0081`) and does not block the release or Resource-Aware Execution branches.

## External runtime alignment (planning)

Task 0097 records the boundary between APK and an external terminal/session runtime such as Herdr. APK is a repository-local semantic workflow/control plane; the external runtime owns PTY, persistent shells, detach/reattach, live process lifetime, remote connectivity, and operator navigation. APK state is repository-local and one APK package may serve many repositories.

Task 0097 amends Tasks 0087 and 0088 before their implementation so attention/status stays semantic and runtime-neutral and isolated workspaces stay safe Git worktree lifecycle only. A future external-runtime dogfood is documented and deferred; no runtime adapter is implemented or planned as a dependency. See [ADR-0039](decisions.md#adr-0039---apk-is-a-repository-local-semantic-control-plane-not-an-external-runtime).
