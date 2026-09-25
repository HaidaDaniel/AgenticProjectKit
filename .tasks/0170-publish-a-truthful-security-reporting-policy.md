# Task 0170 - Publish a truthful security reporting policy

State: blocked
Owner: none
Mode: maintenance
Lane: security
Type: docs
Scope: security,oss,policy,docs
Risk: medium
Parallel: true
Depends on: 0152
Tags: docs

## Context files

- AGENTS.md
- package.json
- docs/product/maturity-and-compatibility.md (future output of prerequisite Task 0152)
- docs/engineering/testing-strategy.md
- .github/workflows/quality.yml
- LICENSE

## Files allowed to edit

- SECURITY.md
- docs/progress.md

## Files forbidden to edit

- src/**
- dist/**
- .tasks/archive/**
- docs/releases/**
- docs/decisions.md
- CONTRIBUTING.md

## Goal

Publish truthful vulnerability reporting guidance after the operator selects or verifies a private reporting channel.

## Steps

1. Remain blocked until the operator confirms an enabled private vulnerability reporting feature or explicitly approved security contact.
2. Verify the route is visible and usable by an external reporter without public disclosure.
3. Write SECURITY.md with supported versions, private report instructions, and handling commitments only if explicitly accepted.
4. Link the policy from public metadata only after the channel is verified.

## Acceptance criteria

- A verified private report path is stated and externally discoverable.
- Supported versions agree with maturity policy.
- No contact, response time, fix deadline, or bounty is invented.
- Policy discourages publishing exploit details publicly.

## Correctness assumptions

- Security reports need a private path.
- The operator chooses any contact address or handling commitment.

## Invariants

- No vulnerability contact is fabricated.
- No SLA exceeds explicit operator policy.

## Required evidence

- Dated evidence identifies the operator-confirmed channel and verification method.
- Rendered policy review confirms external discoverability.

## Review questions

- Can a reporter find a private path without public disclosure?
- Does policy promise an unapproved timeline?

## Counterexample searches

- Try the channel as a non-maintainer and compare it with actual repo settings.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"report","command":"test -s SECURITY.md","artifact":"SECURITY.md"}`
- `{"id":"check-3","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- Intentionally blocked pending operator input; the public release depends on an honest working path.
