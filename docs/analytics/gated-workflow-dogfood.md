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

Status: recorded after the frozen candidate passed gate/`done`. This evidence-only block is not a release candidate.

- Frozen HEAD: `5f65faa6a46c0e48e9586540b943898269fb78f7`; candidate `candidate:eb36a50e44b1f75ca5cd96bc5a3570cb125003d48bcf141f604a61abb1458446`; version `0.3.1`.
- Session: `dogfood-1789143142042-z5b60l`, tool `opencode`, agent `local-agent-0075`, outcome `pass`, evidence `evidence-1789143148803-5dy8gu`.
- Bounded scenario: real CLI in disposable Git repositories across 26 assertions (26/26 passed).
  - low-risk success: create/claim -> verify -> gate -> done.
  - high-risk success: create/claim -> verify -> independent review -> gate -> done.
  - rejections: failed required verification, scope violation, missing live/manual evidence, failed review (then re-verify + fresh independent review -> pass), stale evidence after candidate mutation.
  - compatibility: legacy v0.3.1-style adoption preview is read-only; quality capability detection and contract lint are read-only.
- Retries: 1 (one scenario was initially mis-specified as a `release` tag without a report check; corrected to a live-only `deployment` tag).
- Failure handling: no failed outcome was relabeled; the recorded result is the post-correction pass.
- Limitations: local disposable repositories and the local CLI only. No deployed service, provider runtime, PTY, SSH, remote operator, or model-diverse reviewer was exercised.

