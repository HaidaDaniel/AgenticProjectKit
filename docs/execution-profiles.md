# Resource-Aware Execution

## Status and intent

This document is the accepted architecture for the Resource-Aware Execution milestone. Tasks 0083-0088 implement it on top of the existing task policy, completion gate, evidence, provenance, worker-package, and orchestration contracts. The runtime and CLI behavior described here is not implemented by Task 0082.

Agentic Project Kit remains a repository-first deterministic control plane. External harnesses execute models and tools. APK describes resources, resolves policy, issues bounded work packages, validates results, and presents human decisions; it does not become a model runtime.

The product rule is:

> Use the minimum sufficient assurance and the lowest-cost available worker that can reliably perform the role, preserving scarce frontier inference for work where it materially improves the outcome.

Capability does not imply mandatory execution. Supporting independent or diverse review does not require every medium-risk task to consume it.

## Three independent axes

APK must not overload one setting with three meanings.

| Axis | Answers | Examples |
| --- | --- | --- |
| Project mode | How mature and rigorous is the project/work phase? | `discovery`, `mvp`, `product`, `production`, `maintenance`, `audit`, `adopt` |
| Task risk | What minimum correctness assurance does this change require? | `low`, `medium`, `high`, planned `critical` |
| Execution profile | Which compute/LLM resources exist and how should APK spend them? | `local`, `constrained`, `balanced`, `abundant` |

`mode` retains its current meaning and prompt guidance. `executionProfile` is a separate optional configuration value; changing it must not change a task's project mode or risk.

The effective plan is derived as:

```text
projectMode
+ taskRisk and task classification
+ bounded change characteristics and escalation triggers
+ executionProfile, resource inventory, capacity and budgets
+ explicit user overrides
= effective execution and assurance plan
```

Risk and classification define the safety floor. The execution profile chooses the least expensive valid way to meet it. An override can request stronger execution, but cannot silently lower a mandatory assurance floor or bypass the completion gate.

## Resource model

The registry extends the existing config and `apk-worker-v1` boundary. It does not replace registered agent identity, task ownership, worker sessions, evidence, or provenance.

### Model

A model definition describes model identity or family, capability tier, context capability, reasoning/coding/review suitability, and optional non-secret metadata. It is not directly schedulable.

### Harness

A harness definition describes an execution environment such as Codex, OpenCode, Claude Code, Pi, or another compatible worker harness. It records relevant tools, workspace handling, session isolation, subagent support, and supported worker-protocol versions. It does not imply a specific model.

### Worker/resource

A worker/resource is an executable resource selected by routing. It binds:

- a stable resource ID;
- model and harness references;
- a non-secret endpoint/runtime reference where applicable;
- local or remote location and free, metered, or subscription billing metadata;
- cost/resource class;
- declared and detected availability;
- parallel capacity and current occupancy when known;
- role/capability metadata;
- supported worker protocol and workspace behavior.

Examples are `qwen-local-opencode` and `codex-frontier-main`. Routes target these resource IDs, not a model family name such as "Qwen".

Resource manifests never contain API secrets. Credentials remain owned by the harness/runtime or an external secret facility. APK accepts only non-secret locators or opaque references and rejects secret-shaped fields.

### Cost/resource classes

The planned stable classes are:

| Class | Meaning |
| --- | --- |
| `local-free` | Local or effectively free marginal execution |
| `cheap` | Low-cost metered execution |
| `standard` | Ordinary paid capacity |
| `scarce-frontier` | Strong, quota-limited, or subscription-constrained capacity |

These are vendor-neutral routing inputs, not billing implementation. Capability, cost, availability, and capacity remain separate fields: a local worker may be highly capable for one role, and a frontier worker may be unavailable or unsuitable for another.

## Execution profiles

Profiles define resource-spending strategy. They do not redefine task risk, project rigor, or the evidence accepted by the gate.

| Profile | Typical resources | Default strategy |
| --- | --- | --- |
| `local` | Local model(s) and deterministic tools; no routine frontier capacity | Local-first; deterministic proof; minimal semantic review; frontier only by explicit/manual escalation |
| `constrained` | One scarce frontier worker, local model(s), deterministic tools | Reserve frontier for hard/high-value roles; local-first implementation/review; trigger-based escalation; bounded frontier loops |
| `balanced` | Frontier worker, cheap metered workers, local workers | Frontier for hardest reasoning, cheap tier for intermediate implementation/review, local for simple work; moderate parallelism |
| `abundant` | Multiple strong model families/endpoints plus cheap/local workers | Capability-aware parallel lanes and genuinely independent/diverse review where justified |

`abundant` does not define the architecture of the other profiles. `local` and `constrained` are complete operating modes, not degraded error states.

## Constrained reference design

The primary reference system has:

- one frontier coding subscription with capacity one;
- one local 27B Q4 model with capacity one;
- a local deterministic toolchain with independent process capacity.

Expected baseline routing:

| Role | Route |
| --- | --- |
| `planning.complex` | scarce frontier worker |
| `implementation.low` | local worker |
| `implementation.medium` | local-first; frontier only when complexity/policy requires it |
| `implementation.high` | frontier worker |
| `review.low` | no LLM review |
| `review.medium` | local or conditional review; frontier only on trigger |
| `review.high` | frontier in a fresh context; independent when policy/trigger requires it |
| `review.critical` | strongest valid assurance available; unmet mandatory assurance is explicit |
| documentation and triage | local worker |
| mechanical verification | deterministic tools, no LLM |

Typical frontier escalation triggers include high-risk or difficult work, security/auth changes, migrations, concurrency correctness, local uncertainty, repeated deterministic failures, and significant semantic review triggers.

Capacity is part of the plan. While `codex-frontier-main` is occupied by a complex implementation, APK must not automatically start another frontier-heavy run. The local lane may prepare docs, triage failures, summarize diffs, or perform a first-pass review, while deterministic processes run typecheck, lint, tests, build, and scope checks. Useful work therefore continues without oversubscribing the scarce lane.

For a normal medium-risk constrained task, the intended flow is:

```text
implementation
-> deterministic verification
-> scope, task-contract and changed-files validation
-> conditional/local semantic review when selected
-> completion gate
```

Mandatory frontier independent review is not the medium-risk default.

## Role routing

The deterministic router follows one shared sequence:

1. Resolve task policy, minimum assurance, and any escalation triggers.
2. Identify whether the role is deterministic or requires a semantic worker.
3. Filter registry resources by role capability, protocol, context, workspace, availability, capacity, and policy constraints.
4. Select the lowest-cost eligible resource using stable tie-breaking and profile preferences.
5. Apply explicit user overrides last, while retaining safety-floor and capacity validation.
6. Emit selected and rejected resource reasons, budget effects, and the next action.

Mechanical verification has no worker route. Planning, implementation, review, fix, documentation, and triage can use different resources for the same task while retaining task/run/candidate provenance.

If no resource can satisfy a mandatory role or assurance level, APK reports `unavailable`, `budget-exhausted`, `wait`, or `needs-human`. It does not silently downgrade correctness or mark the task complete.

## Local-first philosophy

Local workers are a distinct low-cost tier, not merely failed frontier substitutes. Suitable work includes:

- context filtering and decomposition sanity checks;
- simple implementation, boilerplate, and straightforward fixes;
- test generation and failure analysis;
- first-pass diff review and summarization;
- documentation, triage, and findings normalization;
- dependency and scope explanations.

Scarce frontier workers are preferred for architecture, ambiguous design, difficult debugging, complex refactors/implementation, security reasoning, high-risk semantic review, and escalation after local uncertainty.

Selection is capability-based. A local resource is used only when its declared/detected capabilities satisfy the role; local-first is not permission to lower the assurance floor.

## Adaptive assurance

The existing independent-review capability, reviewer identity separation, immutable review subject, freshness checks, findings, append-only evidence, and completion gate remain authoritative. Resource-aware assurance generalizes when and how those capabilities are used.

### Assurance levels

| Level | Contract |
| --- | --- |
| `none` | Required deterministic verification only; no semantic LLM review |
| `self-check` | The implementer performs a bounded review of its own diff and task contract; this is not independent certification |
| `fresh-context` | A new isolated context/session reviews the exact candidate; the model/resource may be the same |
| `independent` | A separate worker identity and context review the exact candidate |
| `diverse` | Independent assurance also uses a genuinely different model/resource family when available and required |

The target risk baseline is low -> `none`, medium -> `self-check`, high -> `fresh-context`, and critical -> `independent` with strongest-available/diverse preference. Classification policy and triggers can raise the required level, including to mandatory `diverse`; they cannot lower it. Task 0085 adds `critical` and compatibility normalization without rewriting historical task contracts or evidence.

The execution profile chooses the cheapest valid resource/session arrangement for the required level. For example, a constrained medium task may finish after deterministic checks and a bounded self-check, or use a local fresh-context reviewer when triggered. A security classification can require independent frontier assurance even if the task's base risk is medium.

### Review triggers

Escalation is policy-driven and explainable through stable trigger IDs. The planned trigger set covers:

- security or authentication changes;
- database schema changes or migrations;
- concurrency, async, cancellation, retry, or shutdown correctness;
- public API or compatibility changes;
- large semantic diffs or unusually broad file scope;
- missing, weak, or unexpectedly skipped tests;
- important invariant changes;
- repeated deterministic verification failures;
- implementer uncertainty or low confidence;
- local reviewer uncertainty;
- unexpected scope expansion;
- critical release or integration work.

The list is extensible through the existing deterministic policy mechanism. A trigger records its reason and resulting minimum assurance; it is not an opaque LLM classification.

## Deterministic-first verification

An LLM reviewer is not the first line of defense against mechanical problems. When declared capabilities exist, the preferred order is:

```text
implementation
-> typecheck/static analysis
-> source lint
-> automated tests
-> build/package validation
-> scope validation
-> task-contract validation
-> changed-files validation
-> semantic LLM review, only if required
-> completion gate
```

Required failed or unavailable deterministic checks stay visible under the current evidence/gate contract. Repeated failure may raise an escalation trigger, but sending a broken mechanical candidate to a frontier reviewer does not replace the failed checks.

## Review and resource budgets

Execution policy supports bounded resource controls such as:

- `maxReviewPasses`;
- `maxFrontierReviewPasses`;
- `maxFrontierRunsPerTask`;
- paid-escalation policy and human approval boundary.

The constrained baseline uses `maxFrontierReviewPasses = 1`. A further frontier review requires an explicit policy reason, such as high/critical risk, substantial reviewer-requested changes, or a materially changed candidate. Deterministic re-verification still precedes it.

Budget exhaustion terminates the automatic loop with a clear next action. It never converts missing assurance into PASS. Review -> fix -> review remains available when justified, but orchestration capability alone cannot create an unbounded loop.

## Configuration and precedence

Portable authored state should extend the existing optional `.agentic/config.json` schema instead of introducing several competing config files. Planned optional sections cover:

- selected `executionProfile`;
- secret-free resource/model/harness declarations;
- resource and review budgets;
- generated/calibrated routing recommendation and its inventory fingerprint/provenance;
- user-authored overrides stored separately from generated recommendation.

Precedence is deterministic: built-in defaults -> declared profile/registry -> current detected availability -> validated calibrated recommendation -> user overrides -> safety validation. Generated calibration never deletes or rewrites user overrides.

Detection is read-only by default. Machine-local observations and issued planner sessions may use existing ignored runtime/session storage with timestamps and provenance; they are not a second authoritative configuration. Saving a calibrated recommendation requires explicit apply, is schema-validated, and becomes stale when its inventory fingerprint changes.

## Detect, calibrate, explain

Resource detection and semantic calibration are separate operations.

### Deterministic detection

A future `resources detect`-style command can inspect known harness/runtime markers, declared compatible endpoints, local model descriptions, resource capabilities, cost classes, availability, and concurrency. It reuses repository quality-capability detection from Task 0077. It does not log in to providers, call proprietary APIs, execute a model, or handle secrets.

### Semantic calibration

A future `execution calibrate`-style command:

1. Collects the deterministic inventory, project mode, repository characteristics, quality capabilities, budgets, and overrides.
2. Selects the strongest eligible available planning worker by registry capability and stable policy.
3. Issues a bounded vendor-neutral planning/calibration package by extending the existing worker contract.
4. Receives a routing recommendation from the external harness.
5. Deterministically validates resource IDs, capabilities, capacity, profiles, budgets, and assurance floors.
6. Saves only after explicit apply, preserving user overrides and recording provenance.

An `execution explain`-style view reports the effective profile, routes, assurance, triggers, selected/rejected workers, capacity, budgets, overrides, and calibration provenance. Exact command names remain an implementation taxonomy decision in Task 0086.

APK does not directly become an OpenAI, Anthropic, Grok, or local-runtime SDK router. The external harness executes the planner.

## Resource-aware parallelism

Future orchestration accounts for resource lanes as well as task dependencies. A constrained machine can expose one frontier lane, one local inference lane, and multiple deterministic process slots. A task may progress through different lanes without losing task/run/worker/candidate identity.

The deterministic control plane owns policy and occupancy projection. Independent peer workers perform bounded roles. An LLM planner is invoked only when semantic reasoning is needed; there is no mandatory always-on master LLM.

Resource-aware parallelism initially means capacity-aware routing, queue/wait decisions, and useful work on free lanes. It is not a Kubernetes-like scheduler and does not launch an autonomous swarm.

## Attention and isolated workspaces

Task 0087 extends current status and provenance into a bounded CLI attention view: worker ready/busy/unknown, current task/run, blocked, needs-human, completed, review findings, scarce-lane occupancy, and exact next actions. It is a projection over existing canonical records, not a new state store or dashboard.

Task 0088 adds optional Git worktrees/isolated workspaces for true parallel top-level mutation. It binds task, run, worker/resource, branch, workspace, baseline, and candidate revision. Single-worker operation remains unchanged. Creation and cleanup fail closed; APK removes only exact APK-owned safe worktrees and never deletes user-created, dirty, active, ambiguous, or repository-root paths.

## Compatibility and ownership

- Tasks 0061-0063 remain the historical policy/review/gate foundation.
- Tasks 0070-0073 remain the provenance, status, worker-contract, and orchestration foundation.
- Tasks 0080-0081 remain the review reliability and agent-delegation foundation.
- Tasks 0083-0088 extend those capabilities; completed task contracts and evidence are not rewritten.
- Tasks 0077-0079 remain an independent quality/release chain. Resource detection may consume Task 0077 output, but resource-aware work does not block that chain.

The single completion gate remains the final authority. Resource routing and calibration cannot certify work, mutate historical evidence, or bypass freshness, scope, ownership, verification, and review requirements.

## Non-goals

This milestone does not build:

- an APK-owned LLM runtime;
- a proprietary provider SDK abstraction;
- a secret manager;
- an autonomous swarm framework;
- an always-on master LLM;
- a cloud control plane, SaaS, or dashboard;
- a remote execution platform;
- a billing system;
- a generic Kubernetes-like scheduler;
- mandatory worktrees for single-worker use.

APK remains a lightweight repository-first control plane for coding agents.
