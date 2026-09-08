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

Tasks 0057-0076: todo, unowned. Milestone numbering below belongs to this release; earlier milestones remain historical.

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

### Milestone 5 - Upgrade and Release

- [0074 - Provide safe adoption path for the new gated task workflow](../../.tasks/0074-provide-safe-adoption-path-for-the-new-gated-task-workflow.md)
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
| 0074 | 0062, 0065, 0066, 0071, 0072 |
| 0075 | 0057, 0058, 0059, 0060, 0061, 0062, 0063, 0064, 0065, 0066, 0067, 0068, 0069, 0070, 0071, 0072, 0073, 0074, 0076 |
| 0076 | none |

- 0069 includes 0064, preserving requested review-contract -> dogfood phase edge.
- 0074 includes 0072 because harness interoperability belongs to this release.
- Parallel metadata preserved; overlapping allowed files still require serialized edits.
- Foundation 0001-0056 already done; 0057 needs no unfinished existing prerequisite.
- Gates fail closed: failed/unavailable checks remain unresolved; fixture evidence never substitutes for required live evidence.
- Final release evidence binds actual candidate tree/version and real CLI/dogfood outcomes.
- Evidence binds evaluated HEAD/baseline/worktree identity; stale/superseded records stay visible but cannot satisfy gate. 0070 reports history; 0062 owns enforcement.
- 0075 lifecycle: mutating preparation -> exact candidate freeze -> non-mutating validation using 0066 read-only lint/audit -> evidence. Candidate-input mutation invalidates evidence and requires new freeze/revalidation.
