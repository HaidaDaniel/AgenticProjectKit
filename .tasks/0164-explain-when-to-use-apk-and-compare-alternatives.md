# Task 0164 - Explain when to use APK and compare alternatives

State: todo
Owner: none
Mode: product
Lane: research
Type: docs
Scope: positioning,comparison,product,docs
Risk: medium
Parallel: true
Depends on: 0151,0157
Tags: docs

## Context files

- AGENTS.md
- README.md
- docs/project.md
- docs/scope.md
- docs/architecture.md
- docs/decisions.md
- docs/product/requirements.md
- package.json
- docs/progress.md

## Files allowed to edit

- docs/why-apk.md
- docs/progress.md

## Files forbidden to edit

- README.md
- src/**
- dist/**
- .tasks/archive/**
- docs/releases/**
- docs/decisions.md

## Goal

Explain when APK is useful, when it is not, and how its repository-first workflow differs from adjacent tools.

## Steps

1. Define comparison dimensions from actual APK scope: repository-local state, spec/task generation, brownfield support, candidate-bound evidence, scope enforcement, independent review, and runtime ownership.
2. Recheck current public sources for GitHub Spec Kit, OpenSpec, BMAD, Agent OS, Prospec, and other relevant active tools at execution time.
3. Compare tools only where current source-backed facts can be linked and record the research date and comparison limits.
4. Include concrete fit and non-fit scenarios and clarify APK complements Git, CI, issue tracking, and external runtimes.
5. State that APK does not replace or own model/runtime services.

## Acceptance criteria

- The guide gives at least three fit and three non-fit cases.
- Every named capability claim has a dated direct source link; unavailable facts are labeled unknown rather than inferred.
- No competitor claim is unsupported or presented as superiority proof.
- The page gives a factual “Why APK” explanation suitable for README.

## Correctness assumptions

- Adjacent product capabilities change and need current source attribution.
- Boundaries and scenarios are more maintainable than a feature scorecard.

## Invariants

- No unsupported superiority, security, or performance claim is made.
- External tools are not described as replaced where APK depends on them.

## Required evidence

- A dated, source-backed comparison matrix for the listed tools and a fit/non-fit scenario checklist.

## Review questions

- Would a reader know when not to choose APK?
- Can each named-product claim be checked against a current source?

## Counterexample searches

- Uncited claims, guaranteed outcomes, or implied model-runtime ownership.

## Verification

- `{"id":"check-1","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"pnpm exec apk lint --json"}`
- `{"id":"check-2","type":"automated","required":true,"environment":"local","profile":"deterministic","command":"git diff --check"}`
## Documentation updates

- Update the relevant canonical guide or source document when user-visible behavior or policy changes.
- Record task status changes in docs/progress.md using the repository progress convention.

## Notes

- Help users self-select. Keep comparison small and maintainable.
