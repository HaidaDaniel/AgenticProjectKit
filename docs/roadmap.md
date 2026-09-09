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

Tasks 0057-0080 preserve repository-first, model-agnostic control-plane direction. `done` becomes evidence-backed completion; external coding harnesses remain workers. Tasks 0057-0073 are complete, 0074 is doing and 0075-0080 are planned.

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
