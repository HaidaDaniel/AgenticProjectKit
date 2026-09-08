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

Tasks 0057-0075 preserve repository-first, model-agnostic control-plane direction. `done` becomes evidence-backed completion; external coding harnesses remain workers.

| Milestone | Tasks | Capability |
| --- | --- | --- |
| 1 - Meaningful Done | 0057-0062 | Structured verification, evidence, execution profiles, claim scope, risk policy, completion gate |
| 2 - Independent Correctness | 0063-0066 | Independent review, assumptions/invariants, typed guardrails, built-in consistency lint |
| 3 - Efficient Agent Workflow | 0067-0071 | Budgeted context, change-aware suggestions, dogfood evidence, provenance, explainable status |
| 4 - Harness Interoperability | 0072-0073 | Worker contract, implement/review/fix composition |
| 5 - Upgrade and Release | 0074-0075 | Safe v0.3.1 adoption and candidate-specific release validation |

Task links and direct dependency graph: [delivery milestones](delivery/milestones.md#next-gated-workflow-release-planned).

This backlog excludes model runtime ownership, RAG/vector storage, cloud/UI/SaaS work, autonomous swarms and remote execution. Earlier future ideas remain separate.
