# Task 0101 - Align execution calibration safety with task assurance policy

State: done
Owner: local-agent-0101
Mode: maintenance
Lane: execution
Scope: execution,calibration,resources,config,cli,tests,docs
Risk: medium
Parallel: false
Depends on: none
Tags: none

## Goal

Align execution calibration safety with task assurance policy

## Context files

- AGENTS.md
- docs/execution-profiles.md
- docs/decisions.md
- docs/task-system.md
- src/core/execution/calibrate.ts
- src/core/resources/detect.ts
- src/core/resources/index.ts
- .tasks/0086-resource-detection-and-workflow-calibration.md

## Files allowed to edit

- src/core/execution/calibrate.ts
- src/core/resources/detect.ts
- src/core/resources/index.ts
- src/cli/cli.test.ts
- src/core/config/schema.test.ts
- docs/progress.md
- docs/execution-profiles.md
- docs/decisions.md
- docs/task-system.md

## Files forbidden to edit



## Steps

1. Remove the global calibration assurance floor and make calibration advisory so canonical task policy remains the authority.
2. Add assurance regressions proving low and medium tasks can use none or self-check while high and critical policy cannot be lowered.
3. Make generatedAt change only when effective calibration changes while identical re-apply is idempotent and preserves the timestamp.
4. Fail closed when rereading the raw config for non-ENOENT and invalid JSON errors while preserving unknown user keys.
5. Harden endpoint rejection for credential-like query path bearer and userinfo values without logging the rejected value.

## Acceptance criteria

- Calibration no longer imposes a global fresh-context floor and cannot raise a general minimum above canonical policy.
- Assurance regressions show calibration never lowers canonical task policy and may raise it.
- Changed calibration gets a new generatedAt while identical re-apply preserves the existing timestamp.
- Raw config reread fails closed on non-ENOENT and invalid JSON errors and preserves unknown user keys.
- Credential-like endpoint values are rejected and absent from inventory calibration and human and JSON output.

## Correctness assumptions

- Calibration assuranceMinimum is advisory metadata and the canonical task policy/gate remains authoritative.
- readAgenticConfigFile has already validated the config before apply rereads the raw file.

## Review questions

- Can any path silently downgrade canonical assurance? Can a failed config reread overwrite user configuration with only executionCalibration? Does any rejected secret appear in output?

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm lint"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm test"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm build"}`

## Documentation updates



## Notes

- Corrective hardening of 0086 only. No provider SDKs network probing secret manager runtime executor scheduler or daemon.
