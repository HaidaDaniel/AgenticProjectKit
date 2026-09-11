# Milestones

## Milestone 1

- repository documentation phase complete;
- task system defined;
- agent instructions defined;
- roadmap established.

## Milestone 2

- TypeScript CLI scaffold;
- config schema;
- init command;
- task and context plumbing.

## Milestone 3

- template rendering;
- minimal doc generation;
- agent exporters;
- adoption flow.

## Milestone 4

- task selection;
- prompt generation;
- stronger scanning;
- broader export support.

## Next gated-workflow release (planned)

Tasks 0057-0074 and 0076-0081: done. Task 0075 is in frozen-release preparation. Milestone numbering below belongs to this release; earlier milestones remain historical.

APK remains model-agnostic repository-first control plane. External harnesses own model execution; APK owns task contracts, verification, scope, evidence, review and completion.

### Milestone 1 - Meaningful Done

- [0057 - Structured task verification contract with backward compatibility](../../.tasks/0057-structured-task-verification-contract-with-backward-compatibility.md)
- [0058 - Add first-class task evidence records](../../.tasks/0058-add-first-class-task-evidence-records.md)
- [0059 - Execute task verification profiles and record evidence](../../.tasks/0059-execute-task-verification-profiles-and-record-evidence.md)
- [0060 - Track task claim baseline and enforce allowed-file scope](../../.tasks/0060-track-task-claim-baseline-and-enforce-allowed-file-scope.md)
- [0061 - Introduce risk and task-policy requirements](../../.tasks/0061-introduce-risk-and-task-policy-requirements.md)
- [0063 - Add independent task review and review evidence](../../.tasks/0063-add-independent-task-review-and-review-evidence.md)
- [0062 - Gate task completion on verification, scope, policy and evidence](../../.tasks/0062-gate-task-completion-on-verification-scope-policy-and-evidence.md)

Policy resolution in 0061 and review capability in 0063 precede final done enforcement in 0062.

#### Reliability / Foundation

- [0076 - Recover stale task mutation locks safely](../../.tasks/0076-recover-stale-task-mutation-locks-safely.md): independent prerequisite for final release; serialize edits to shared workflow files.
- [0080 - Resolve Task 0073 independent-review reliability findings](../../.tasks/0080-resolve-task-0073-independent-review-reliability-findings.md): bounded P2 follow-up; serialize with 0076 because evidence/workflow files overlap.

### Milestone 2 - Independent Correctness

- [0064 - Add correctness assumptions and adversarial review contract](../../.tasks/0064-add-correctness-assumptions-and-adversarial-review-contract.md)
- [0065 - Add typed task templates with domain-specific guardrails](../../.tasks/0065-add-typed-task-templates-with-domain-specific-guardrails.md)
- [0066 - Add built-in repository and task-contract linting](../../.tasks/0066-add-built-in-repository-and-task-contract-linting.md)

### Milestone 3 - Efficient Agent Workflow

- [0067 - Generate budgeted task context packs](../../.tasks/0067-generate-budgeted-task-context-packs.md)
- [0068 - Make context suggestions dependency- and change-aware](../../.tasks/0068-make-context-suggestions-dependency-and-change-aware.md)
- [0069 - Add bounded agent dogfooding evidence](../../.tasks/0069-add-bounded-agent-dogfooding-evidence.md)
- [0070 - Add end-to-end task execution provenance](../../.tasks/0070-add-end-to-end-task-execution-provenance.md)
- [0071 - Expose concise workflow, gate and evidence status](../../.tasks/0071-expose-concise-workflow-gate-and-evidence-status.md)

### Milestone 4 - Harness Interoperability

- [0072 - Define model-agnostic worker and harness integration contract](../../.tasks/0072-define-model-agnostic-worker-and-harness-integration-contract.md)
- [0073 - Compose implementation, review and fixer runs without owning the model runtime](../../.tasks/0073-compose-implementation-review-and-fixer-runs-without-owning-the-model-runtime.md)
- [0081 - Allow automatic independent review orchestration](../../.tasks/0081-allow-automatic-independent-review-orchestration.md)

### Milestone 5 - Upgrade, Quality and Release

- [0074 - Provide safe adoption path for the new gated task workflow](../../.tasks/0074-provide-safe-adoption-path-for-the-new-gated-task-workflow.md)
- [0077 - Add repository quality capability detection and policy contracts](../../.tasks/0077-add-repository-quality-capability-detection-and-policy-contracts.md)
- [0078 - Add first-class local quality guardrails for AgenticProjectKit itself](../../.tasks/0078-add-first-class-local-quality-guardrails-for-agenticprojectkit-itself.md)
- [0079 - Add minimal clean-checkout CI and release-quality proof for AgenticProjectKit](../../.tasks/0079-add-minimal-clean-checkout-ci-and-release-quality-proof-for-agenticprojectkit.md)
- [0075 - Validate next AgenticProjectKit release against gated workflow](../../.tasks/0075-validate-next-agenticprojectkit-release-against-gated-workflow.md)

### Dependency map

Each row lists direct prerequisites; all IDs numeric. Release validation includes all tasks in this backlog.

| Task | Depends on |
| --- | --- |
| 0057 | none |
| 0058 | 0057 |
| 0059 | 0057, 0058 |
| 0060 | 0058 |
| 0061 | 0057, 0058 |
| 0062 | 0059, 0060, 0061, 0063 |
| 0063 | 0058, 0061 |
| 0064 | 0063 |
| 0065 | 0061, 0064 |
| 0066 | 0057, 0060, 0061 |
| 0067 | 0057 |
| 0068 | 0067 |
| 0069 | 0058, 0063, 0064 |
| 0070 | 0058, 0060, 0062, 0063 |
| 0071 | 0062, 0070 |
| 0072 | 0063, 0067, 0070 |
| 0073 | 0072, 0063, 0062 |
| 0074 | 0062, 0065, 0066, 0071, 0072, 0073 |
| 0075 | 0057, 0058, 0059, 0060, 0061, 0062, 0063, 0064, 0065, 0066, 0067, 0068, 0069, 0070, 0071, 0072, 0073, 0074, 0076, 0077, 0078, 0079, 0080 |
| 0076 | none |
| 0077 | 0074 |
| 0078 | 0077 |
| 0079 | 0078 |
| 0080 | 0073 |
| 0081 | 0076 |

- 0069 includes 0064, preserving requested review-contract -> dogfood phase edge.
- 0074 includes 0072 and 0073 because adoption covers complete worker/harness workflow. 0073 edge was added after 0074 entered `doing`; historical claim/baseline remain unchanged.
- 0077 -> 0078 -> 0079 separates vendor-neutral capability contracts, APK-local tooling and clean-checkout CI.
- 0076 and 0080 remain graph-independent but implementation must be serialized due evidence/workflow file overlap.
- Parallel metadata preserved; overlapping allowed files still require serialized edits.
- Foundation 0001-0056 already done; 0057 needs no unfinished existing prerequisite.
- Gates fail closed: failed/unavailable checks remain unresolved; fixture evidence never substitutes for required live evidence.
- Final release evidence binds actual candidate tree/version, real CLI/dogfood outcomes and exact-SHA hosted CI status where available.
- Hooks provide local feedback; APK verify/gate provides task proof; CI proves clean checkout; 0075 proves frozen release candidate. No layer substitutes for missing evidence from another.
- Evidence binds evaluated HEAD/baseline/worktree identity; stale/superseded records stay visible but cannot satisfy gate. 0070 reports history; 0062 owns enforcement.
- 0075 lifecycle: mutating preparation -> exact candidate freeze -> non-mutating validation using 0066 read-only lint/audit -> evidence. Candidate-input mutation invalidates evidence and requires new freeze/revalidation.

## Resource-Aware Execution (planned after gated workflow)

[Architecture](../execution-profiles.md) is fixed by Task 0082. Tasks 0083-0088 implement the milestone without rewriting completed contracts or blocking the existing 0077 -> 0078 -> 0079 quality chain.

| Task | Title | Priority | Direct dependencies |
| --- | --- | --- | --- |
| 0082 | Document resource-aware execution architecture and backlog | planning | none |
| 0083 | Resource and Worker Registry | P0 | 0072, 0074, 0082 |
| 0084 | Execution Profiles and Resource-Aware Routing | P0 | 0061, 0073, 0083 |
| 0085 | Adaptive Assurance and Review Budget | P0 | 0062, 0063, 0080, 0081, 0084 |
| 0086 | Resource Detection and Workflow Calibration | high | 0077, 0085 |
| 0087 | Worker Attention and Resource Status | later | 0070, 0071, 0085 |
| 0088 | Optional Isolated Parallel Workspaces | later | 0070, 0073, 0084, 0087 |

```text
0082 -> 0083 -> 0084 -> 0085
                          |----> 0086 (+ 0077)
                          `----> 0087 (+ 0070, 0071) -> 0088
                                                           (+ 0070, 0073, 0084)
```

The ordering is A -> B -> adaptive assurance, after which calibration and attention can proceed independently; workspaces remain downstream of attention. `constrained` is the reference profile. Deterministic checks precede optional semantic review, frontier review loops are bounded, and an unmet mandatory assurance level remains a visible blocker.

## Exporter consolidation (planned maintenance)

- [0092 - Consolidate agent instruction exports around canonical `AGENTS.md`](../../.tasks/0092-consolidate-agent-instruction-exports-around-canonical-agentsmd.md)

This bounded follow-up depends on completed exporter/sync, contract-lint, adoption-compatibility and generated-policy foundations (`0029`, `0040`, `0066`, `0074`, `0081`). It is independent of the active release task and the Resource-Aware Execution implementation chain.
