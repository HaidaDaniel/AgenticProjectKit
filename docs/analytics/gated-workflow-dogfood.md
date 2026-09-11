# Gated-workflow dogfood

Task 0075 uses one bounded real CLI session against isolated repositories. Automated fixtures remain test evidence and do not substitute for this session.

## Scenario

- exercise low-risk claim -> verify -> done;
- exercise high-risk claim -> verify -> independent review -> gate -> done;
- confirm scope, required-check, live/manual, and failed-review rejection paths;
- inspect v0.3.1 adoption, quality-capability, stale-lock, and worker-review reliability behavior;
- record observations, retries, failures, and issues through `apk task dogfood`.

The session uses the repository CLI and local disposable repositories. It does not prove a deployed service, provider runtime, PTY, SSH, or remote operator behavior.

## Result

Status: pending post-gate evidence append.

