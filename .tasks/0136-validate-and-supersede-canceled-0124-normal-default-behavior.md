# Task 0136 - Validate and supersede canceled 0124 normal-default behavior

State: doing
Owner: code-owner-0136
Mode: maintenance
Lane: instructions
Type: test
Scope: agent-style,config,exporters,adoption,tests,docs
Risk: medium
Parallel: false
Depends on: none
Tags: tests

## Goal

Validate the already-landed normal-default and explicit-caveman-opt-in behavior of canceled Task 0124 against its acceptance boundaries using existing tests, add only missing focused regressions, and record a formal supersession so release Task 0133 no longer depends on the canceled task. Do not change runtime behavior without a reproducer.

## Context files

- src/core/config/defaults.ts
- src/core/config/schema.test.ts
- src/core/exporters/index.ts
- src/core/templates/renderer.test.ts
- src/core/init/index.ts
- src/core/init/init.test.ts
- src/core/docs/adopt.ts
- src/core/docs/adopt.test.ts
- src/core/sync/index.ts
- src/core/sync/sync.test.ts
- src/cli/cli.test.ts
- src/cli/commands/export.ts
- .agentic/config.json
- AGENTS.md
- .tasks/0124-make-caveman-explicitly-user-opt-in-instead-of-an-automatic-default.md
- .tasks/0134-regenerate-agentsmd-and-committed-dist-for-the-normal-default-style.md
- docs/decisions.md

## Files allowed to edit

- src/core/exporters/index.ts
- src/core/templates/exporters/agents.md.hbs
- src/core/init/init.test.ts
- src/core/docs/adopt.test.ts
- src/core/sync/sync.test.ts
- src/core/templates/renderer.test.ts
- src/core/config/schema.test.ts
- src/cli/cli.test.ts
- src/core/config/defaults.ts
- src/core/init/index.ts
- src/core/docs/adopt.ts
- src/core/sync/index.ts
- AGENTS.md
- README.md
- docs/project.md
- docs/agent-exporters.md
- docs/decisions.md
- docs/progress.md
- dist/**

## Files forbidden to edit



## Steps

1. Map each 0124 acceptance boundary to the test that actually proves it today (schema defaults, init, adopt, export/sync, style rules, cli). Record which are proven and which are only asserted textually.
2. Add only the missing focused regressions needed to prove the unproven boundaries; do not duplicate existing coverage. If a real runtime defect is found, add a reproducer first and either fix it here only if small and explicitly allowed, or create a separate narrowly scoped corrective task.
3. Verify the current repository artifacts match config: `.agentic/config.json` is `normal`, generated `AGENTS.md` matches config-aware rendering, and committed `dist/` matches source.
4. Correct the stale present-tense statement in `docs/progress.md` that still claims `caveman` is the default agent style (present-tense project status must be current; historical statements and ADR-0006 stay untouched).
5. Record the formal supersession of canceled 0124 (validated behavior, successor task id) in `docs/progress.md` and, if warranted, `docs/decisions.md`, without touching 0124's canceled contract.
6. Run every declared check, commit the candidate, `apk task verify`, gate, `apk done`, then a separate bookkeeping commit.

## Acceptance criteria

- Missing/omitted `agentStyle` resolves to `normal`, and `DEFAULT_CONFIG.agentStyle` and `DEFAULT_AGENT_POLICY.defaultStyle` agree.
- Fresh `init` and fresh `adopt` produce `normal` config and normal canonical policy.
- Normal `export`/`sync` render concise normal rules; explicit persisted `agentStyle: caveman` renders caveman rules; switching config back to `normal` removes caveman activation rules.
- A legacy stored `agentStyle: caveman` is preserved (not silently migrated) and generic "be brief"/"save tokens" requests, task complexity, or an installed skill are not caveman authorization.
- A transient opt-in does not persist config; customized downstream instructions/config are not silently migrated.
- No skill installer, provider runtime, or new CLI command was introduced for style handling.
- Generated `AGENTS.md` matches the current config-aware rendering and committed `dist/` matches source.
- `docs/progress.md` no longer claims caveman is the default in present tense; historical ADR-0006 and historical task contracts are untouched.
- Canceled Task 0124 is explicitly and honestly superseded by this validated successor; its canceled contract and evidence are not rewritten or rebound.
- Existing tests where they already prove a boundary are reused; only genuinely missing regressions are added.
- All declared deterministic checks pass.

## Correctness assumptions

- The normal-default source change (`DEFAULT_CONFIG.agentStyle`, `DEFAULT_AGENT_POLICY.defaultStyle`, `styleRulesFor`) is already landed in commit `1858d34` and generated artifacts were repaired by Task 0134.
- `schemaVersion` is distinct from the APK package version and is unaffected by style handling.
- A canceled task cannot be `done`; supersession is recorded, not a lifecycle resurrection.

## Invariants

- No runtime behavior change without a failing reproducer.
- Canceled Task 0124 and its evidence are never rewritten, rebound, or force-completed.
- No new dependency, command, installer, or provider integration is introduced.

## Required evidence

- A boundary-to-test mapping for the 0124 acceptance criteria, the focused new regressions (if any), and the passing deterministic check output.

## Review questions

- Does every claimed 0124 boundary have a test that actually proves it rather than merely asserting text?
- Is the caveman-vs-generic-brevity distinction genuinely enforced and tested?
- Was any runtime change made without a reproducer?
- Is the supersession recorded without mutating the canceled task?

## Counterexample searches

- Config omitting `agentStyle`; explicit `normal`; explicit `caveman`; legacy inherited `caveman`.
- Generic "be brief"/"save tokens" requests; installed-skill presence; task complexity.
- Customized downstream `AGENTS.md` and unknown config keys.
- A transient session opt-in followed by a check-only command.

## Verification

- `{"id":"typecheck","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm typecheck"}`
- `{"id":"source-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"tests","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"build","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`
- `{"id":"contract-lint","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js lint --json"}`
- `{"id":"sync-current","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node dist/cli/index.js sync"}`

## Documentation updates

- docs/progress.md
- docs/decisions.md

## Notes

- Successor/validation for canceled Task 0124: validates already-landed behavior and records supersession; it does not resurrect or rebaseline the canceled task.
- Only add regressions that prove currently unproven boundaries; reuse existing tests where they already prove a boundary.
- Remove the stale present-tense `caveman` default claim in `docs/progress.md`.
