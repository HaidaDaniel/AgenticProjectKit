# Task 0170 - Publish a truthful security reporting policy

State: blocked
Owner: none
Mode: maintenance
Lane: security
Type: docs
Scope: security,oss,policy,docs
Risk: medium
Parallel: true
Depends on: 0152,0158,0163,0168
Tags: docs

## Goal

Publish truthful vulnerability reporting guidance after the operator selects or verifies a private reporting channel.

## Context files

- AGENTS.md
- package.json
- README.md
- docs/index.md (future output of prerequisite Task 0158)
- docs/product/maturity-and-compatibility.md (future output of prerequisite Task 0152)
- docs/engineering/testing-strategy.md
- .github/workflows/quality.yml
- LICENSE

## Files allowed to edit

- SECURITY.md
- README.md
- docs/index.md
- docs/progress.md

## Files forbidden to edit

- src/**
- dist/**
- .tasks/archive/**
- docs/releases/**
- docs/decisions.md
- CONTRIBUTING.md

## Steps

1. Remain blocked until the operator confirms an enabled private vulnerability reporting feature or explicitly approved security contact.
2. Verify the route is visible and usable by an external reporter without public disclosure.
3. Write SECURITY.md with supported versions, private report instructions, and handling commitments only if explicitly accepted.
4. After the channel is verified, add only a short navigation link to SECURITY.md in README.md and docs/index.md; do not duplicate policy content there.
5. Run the exact deterministic documentation check `node scripts/check-docs-consistency.mjs` selected by Task 0168.

## Acceptance criteria

- A verified private report path is stated and externally discoverable.
- Supported versions agree with maturity policy.
- No contact, response time, fix deadline, or bounty is invented.
- Policy discourages publishing exploit details publicly.
- README.md and docs/index.md contain only minimal navigation links to the policy after the private route is verified.
- The exact `node scripts/check-docs-consistency.mjs` check passes after the policy links are added.

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
- `{"id":"check-4","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"node scripts/check-docs-consistency.mjs"}`

## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- Intentionally blocked pending operator input; the public release depends on an honest working path.
- block: Operator decision 2026-10-07: GitHub Private Vulnerability Reporting is the chosen official private channel after publication; no separate security email, SLA, bounty, or deadlines. Operator reports repository still private: publish then enable PVR and verify Report a vulnerability as external non-maintainer before claim/reverify, truthful SECURITY.md/navigation, review/gate/done. Current public API reports private=false but the security page offers no Report a vulnerability: route remains unavailable/unverified.
