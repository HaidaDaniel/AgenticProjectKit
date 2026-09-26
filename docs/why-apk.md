# Why Agentic Project Kit?

**Research checked: 2026-09-26.** This page helps teams decide whether APK fits their workflow. Product pages change; revisit the linked sources before making a new comparison. The comparison reports what each project's public documentation describes. It is not a benchmark, security assessment, or ranking.

## The short answer

Agentic Project Kit (APK) keeps project context, task contracts, agent guidance, and workflow evidence with each repository. Use it when multiple coding-agent sessions or tools need to follow the same visible rules, work within declared file scope, and leave verification and review evidence tied to the candidate being completed. The repository remains the source of truth; APK provides a CLI for that workflow ([project scope](scope.md), [task system](task-system.md#verification-contract), [architecture](architecture.md#current-runtime-boundary)).

APK manages task planning and lifecycle, bounded context and worker packages, allowed/forbidden file checks, candidate-bound verification and review evidence, provenance, policy, and a completion gate. For existing codebases, `apk adopt` adds missing kit files conservatively and preserves application code and customized files ([product requirements](product/requirements.md#supported-repository-workflows), [CLI behavior](cli-commands.md)).

### Choose APK when

- Several agent tools or sessions need durable project instructions and task state that can be reviewed and versioned with the repository.
- Existing application work should be introduced task by task, with explicit scope and checks, rather than converted wholesale into a second specification corpus.
- A team needs verification and any required independent review associated with the current candidate, and needs completion to fail visibly when evidence is missing or stale ([verification contract](task-system.md#verification-contract), [independent review](task-system.md#independent-review), [completion gate](task-system.md#completion-gate)).
- The team already chooses its own coding agent, model, terminal/session runtime, Git host, and CI; it wants repository-local workflow control around them ([runtime boundary](architecture.md#current-runtime-boundary)).

### Choose something else when

- The main requirement is a model runtime, autonomous coding-session launcher, remote execution service, hosted agent, or terminal/SSH/session manager. APK prepares and records work; an external harness or runtime executes it ([architecture](architecture.md#current-runtime-boundary)).
- A central cloud issue tracker or cross-repository planning service must be the workflow source of truth. APK does not synchronize issue trackers or own a hosted project database ([scope](scope.md#current-non-goals)).
- You primarily want a feature-spec generation process, a role/skill-led method, or standards injection. The tools below document those workflows directly and may be a better fit.
- A small project already works well with a README, a few Markdown tasks, Git, and its existing CI. APK adds explicit lifecycle and evidence policy; adopt it only if those controls solve a real coordination problem.

## What APK means by repository-first control

These are the comparison dimensions behind the fit guidance, not a feature scorecard.

| Dimension | APK's documented contract |
| --- | --- |
| Repository-local state | Project docs, config, task contracts, agent instructions, and task lifecycle records live with each repository. APK has no hosted project database ([project](project.md), [scope](scope.md)). |
| Specs and tasks | APK uses explicit task contracts with dependencies, context, allowed/forbidden paths, acceptance criteria, and declared verification. It offers task creation and planning assets; it does not require every project to create a full feature-spec set before work ([task creation](task-system.md#task-creation), [optional planning assets](task-system.md#optional-project-grill)). |
| Brownfield adoption | `apk adopt` inspects an existing repository and adds missing kit files conservatively; legacy config changes use an explicit migration action ([requirements](product/requirements.md#brownfield)). |
| Candidate-bound evidence | Verification and review identify the candidate they assess; freshness is checked by the same completion gate ([evidence records](task-system.md#evidence-records), [gate](task-system.md#completion-gate)). |
| Scope enforcement | Verification attributes changed paths to the task baseline and checks the task's allowed and forbidden paths before a successful completion ([verification](task-system.md#verification), [scope](task-system.md#verification-contract)). |
| Independent review | Effective policy determines whether a separate reviewer is required. APK records reviewer identity and candidate-bound findings; an implementer's self-check has a separate assurance level ([independent review](task-system.md#independent-review)). |
| Runtime ownership | APK issues a vendor-neutral work package and validates returned results. A coding harness owns model execution, processes, terminals, and remote sessions ([worker boundary](architecture.md#model-agnostic-worker-boundary), [runtime boundary](architecture.md#current-runtime-boundary)). |

## Nearby tools and when they fit

Each link below is a direct first-party project or product source checked on **2026-09-26**. These pages describe their authors' intended workflows; they do not establish feature parity or comparative outcomes. Use the linked detail pages when a particular enforcement or evidence guarantee matters.

| Tool | What its current public documentation describes | Consider it when |
| --- | --- | --- |
| [GitHub Spec Kit — official docs, checked 2026-09-26](https://github.github.com/spec-kit/) ([existing-project guide](https://github.com/github/spec-kit/blob/main/docs/guides/existing-projects.md)) | A coding-agent process toolkit with a core Specify → Plan → Tasks → Implement → Converge flow, plus separately selectable bug-fixing and idea-assessment processes. It documents adoption into an existing codebase. | You want a spec-led process with extensible workflows and integrations, and want feature artifacts to drive planning and convergence. |
| [OpenSpec — project README, checked 2026-09-26](https://github.com/Fission-AI/OpenSpec) ([existing-project guide](https://github.com/Fission-AI/OpenSpec/blob/main/docs/existing-projects.md)) | Change folders with proposal, specs, design, and tasks; its brownfield guide recommends writing delta specs for the change at hand. The README describes editing artifacts at any point and lists more than 30 assistant integrations. Cross-repository Stores are marked beta in its docs. | You want iterative, change-focused specification artifacts, especially for brownfield work, and prefer a workflow without fixed artifact-phase gates. |
| [BMad Method — official docs, checked 2026-09-26](https://docs.bmad-method.org/) ([existing-codebase guide](https://docs.bmad-method.org/existing-codebases/start-in-an-existing-codebase/)) | Named skills cover research and planning as well as building and reviewing changes. The existing-codebase guide describes using project context, choosing a small or larger planning path, then building against the code already present. | You want a skill-led method with explicit planning and build paths, including an option to start small in an existing codebase. |
| [Agent OS — v3 migration guide, checked 2026-09-26](https://buildermethods.com/agent-os/migration) ([concepts](https://buildermethods.com/agent-os/concepts)) | The v3 guide centers standards, profiles, and stronger specs; it uses an agent's Plan Mode for spec writing and leaves task breakdown and implementation orchestration to the coding tools. Standards can be discovered and injected into an agent's context. | You mainly want agents to learn and apply project conventions and want shaped specs saved through your coding tool's planning workflow. |
| [Prospec — project README, checked 2026-09-26](https://github.com/benwu95/prospec) | Its README describes a CLI-first SDD workflow in which Skills handle judgment and the CLI handles deterministic bookkeeping such as status transitions, quality logs, grading, and spec sync. The documented flow includes review, verification, and structured project knowledge. These are the project's own descriptions. | You want that CLI-and-Skills workflow and its progressive project-knowledge model; inspect its current install and enforcement docs for your environment. |
| [Kiro — official specs guide, checked 2026-09-26](https://kiro.dev/docs/specs/) ([surfaces](https://kiro.dev/docs/)) | Requirements, design, and task artifacts are part of its Specs workflow. Current docs describe IDE, CLI, Web, and Mobile surfaces sharing an agent harness, with task execution available from the spec task list. | You want specification workflows together with an integrated agent environment and its supported execution surfaces. |
| [GitHub Issues and Actions — official docs, checked 2026-09-26](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues) ([Actions](https://docs.github.com/en/actions/get-started/understand-github-actions)) | Issues support tasks, sub-issues, and dependencies; Actions automates repository workflows such as builds and tests. | Those hosted issue and CI workflows already meet your coordination needs. Keep them as the issue and CI systems if you add APK; APK has no issue-tracker sync and does not replace hosted CI. |

### Comparison limits

The linked overview pages do not establish whether every listed tool provides APK-equivalent candidate-bound evidence, allowed/forbidden path enforcement, identity-separated independent review, freshness checks, or a completion gate. Those details are **unknown in this comparison** because they were not verified from the reviewed public sources. Check each tool's current implementation and detailed documentation before depending on a specific guarantee.

This is a comparison of documented purpose and workflow, not hands-on testing. It makes no claims about security, speed, quality, pricing, or universal compatibility. Tool versions and documentation can change after the research date.

## APK works alongside your existing stack

Keep each system in its documented role:

- **Git** stores code, branches, and reviewable repository history. APK uses local Git facts and can manage bounded Git worktrees; it does not replace Git hosting or remote operations.
- **CI** executes the repository's hosted checks. APK can record and gate on the required evidence; a local command run is not hosted-CI evidence ([testing strategy](engineering/testing-strategy.md#clean-checkout-ci), [verification](task-system.md#verification)).
- **Issue tracking** coordinates hosted or cross-repository work. APK task contracts remain repository-local, and there is no synchronization layer ([scope](scope.md#current-non-goals)).
- **Coding agents and external runtimes** perform implementation, run commands, and own model or session execution. APK supplies bounded context and records the workflow result ([worker contract](architecture.md#model-agnostic-worker-boundary), [runtime boundary](architecture.md#current-runtime-boundary)).

### README-ready description

Agentic Project Kit keeps task contracts, project instructions, and workflow records in each repository. It helps teams coordinate coding agents with explicit task scope, candidate-bound verification and review evidence, and a completion gate. Use APK beside Git, hosted CI, an issue tracker, and the coding-agent runtime your team already operates; APK supplies the repository-local workflow layer ([scope](scope.md), [task system](task-system.md#completion-gate), [runtime boundary](architecture.md#current-runtime-boundary)).
