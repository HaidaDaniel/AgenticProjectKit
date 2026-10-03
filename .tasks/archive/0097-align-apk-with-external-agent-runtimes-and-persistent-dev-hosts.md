# Task 0097 - Align APK with external agent runtimes and persistent dev hosts

State: done
Owner: local-agent-0097
Mode: production
Lane: planning
Scope: documentation,architecture,planning,attention,workspaces
Risk: medium
Parallel: false
Depends on: 0075
Tags: planning,architecture,documentation,external-runtime,attention,workspaces

## Goal

Record and align the boundary between APK as a repository-local semantic workflow/control plane and external terminal/session runtimes such as Herdr, without implementing any external runtime.

## Context files

- AGENTS.md
- docs/architecture.md
- docs/execution-profiles.md
- docs/roadmap.md
- docs/decisions.md
- docs/progress.md
- docs/task-system.md
- .tasks/0086-resource-detection-and-workflow-calibration.md
- .tasks/0087-worker-attention-and-resource-status.md
- .tasks/0088-optional-isolated-parallel-workspaces.md

## Files allowed to edit

- docs/architecture.md
- docs/execution-profiles.md
- docs/decisions.md
- docs/roadmap.md
- docs/progress.md
- docs/task-system.md
- README.md
- .tasks/0087-worker-attention-and-resource-status.md
- .tasks/0088-optional-isolated-parallel-workspaces.md
- .tasks/0097-align-apk-with-external-agent-runtimes-and-persistent-dev-hosts.md

## Files forbidden to edit

- package.json
- pnpm-lock.yaml
- scripts/**
- .github/**
- .tasks/archive/**
- src/**
- src/core/templates/minimal-docs/**
- .agentic/config.json

## Steps

1. Record the boundary decision: APK is the repository-local semantic workflow/control plane; an external terminal/process/session runtime (for example Herdr) owns PTY, persistent shells, detach/reattach, live process lifetime, remote connectivity, and operator navigation.
2. Document the supported multi-machine operating model: operator machine -> remote SSH/external runtime -> persistent Ubuntu dev host -> independent repository-local APK state per repo; no global APK project database.
3. Amend Task 0087 so attention/status remains semantic and runtime-neutral and never asserts live process facts without external-runtime evidence.
4. Amend Task 0088 so isolated workspaces remain safe Git worktree ownership/lifecycle only, never PTY/SSH/multiplexer/process-supervisor/remote-scheduler behavior.
5. Document a future, deferred Herdr dogfood plan without creating any Herdr integration implementation task or dependency.

## Acceptance criteria

- A single boundary decision is recorded in docs/decisions.md and summarized in docs/architecture.md and docs/execution-profiles.md.
- APK ownership and external-runtime ownership are each listed explicitly, and APK non-goals include terminal emulator, tmux clone, Herdr clone, SSH manager, global process supervisor, global APK daemon, cloud coordination, and generic swarm.
- The multi-machine operating model states that APK state is repository-local, there is no global APK project DB, and one APK executable/package can serve many repositories.
- Task 0087 explicitly forbids unsupported live-process claims (PID alive, agent generating tokens, terminal responsive, SSH alive, agent physically idle) and keeps machine-readable output runtime-neutral (apk status, apk workers, apk attention).
- Task 0088 explicitly forbids PTY, SSH, terminal multiplexer, process supervisor, and remote scheduler behavior and keeps the safe Git worktree ownership/lifecycle boundary.
- The future Herdr dogfood plan is documented as deferred validation only, with no integration implementation task or new dependency created.
- No implementation code, package script, or dependency is changed; task contracts still parse and the graph stays acyclic.

## Verification

- `{"id":"contract-lint","type":"automated","required":true,"environment":"static","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`

## Documentation updates

- Update docs/decisions.md with the external-runtime boundary decision.
- Update docs/architecture.md and docs/execution-profiles.md with the boundary, multi-machine model, and deferred dogfood plan.
- Update docs/roadmap.md and docs/progress.md for the planning alignment.
- Amend .tasks/0087 and .tasks/0088 contracts before their implementation.

## Notes

- Backlog reference: post-0075 planning alignment, precedes 0092/0086/0087/0088.
- This is a documentation/task-contract alignment task. It is not Herdr implementation and does not add a Herdr dependency.
- APK owns: tasks, dependencies, claim/ownership, scope, risk, execution profile, resources, routing, assurance, verification, review, evidence, provenance, gate, semantic attention, and safe Git worktree ownership/lifecycle.
- External runtime owns: PTY, terminal panes, persistent shells, detach/reattach, live process lifetime, remote-machine connectivity, SSH/session UI, and operator navigation.
- APK must not implement: terminal emulator, tmux clone, Herdr clone, SSH manager, global process supervisor, global APK daemon, cloud coordination, or a generic swarm.
- Future Herdr dogfood plan is deferred: use a persistent Ubuntu dev host, install Herdr separately, one Herdr workspace per repo, run Codex/OpenCode in repo cwd, test multiple repos, test a Windows -> Ubuntu remote workflow, test parallel APK worktrees, collect UX problems, and only then decide whether a Herdr adapter is warranted. No Herdr integration implementation task is created here.
- Context lists current files and prerequisite contracts. If scope must expand, amend the task before editing.
