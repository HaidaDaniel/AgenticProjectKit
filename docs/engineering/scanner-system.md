# Scanner System

The scanner system will inspect the repository during `audit` and `adopt`.

## Goals

- detect the existing stack;
- identify repository structure;
- find documentation gaps;
- find candidate task boundaries;
- support context selection.

Quality detection is a shared read-only scanner projection. Its stable capability IDs are `typecheck`, `lint`, `tests`, `build`, `coverage`, `hooks`, and `ci`; script/config/vendor strings remain evidence metadata. The scanner distinguishes detected, missing, and unknown, and evaluates only explicitly configured required/recommended policy.

Application/runtime evidence is a separate additive projection from repository tooling. The scanner preserves the legacy flat `detectedStack`, and also emits application runtimes, tooling stack, ambiguous runtimes, and bounded runtime components. A root `package.json` is not application evidence by itself: an APK dependency is tooling evidence, while a real entrypoint, production dependency, application framework, runtime script, or nested component can prove Node application ownership. Runtime-script evidence is command-aware, so a script name alone does not prove Node ownership. The optional `.agentic/config.json` `runtimeManifestRole` field accepts only `application`, `tooling`, or `mixed` for the root manifest; it changes ownership classification, not detected capabilities. Nested component discovery is read-only, deterministic, and bounded by depth and directory limits; when the bound is reached, the runtime projection reports a diagnostic instead of implying complete discovery.

## Expected inputs

- filesystem structure;
- package manifest files;
- docs and config files;
- existing agent instructions;
- test and build files;
- project-specific conventions.

## Rules

- Prefer deterministic scans over heuristic guesswork.
- Record findings in docs rather than mutating code during audit.
- Keep adoption changes conservative.
- Use scan results to shape generated docs and tasks.
- Never execute repository commands, install dependencies, or write hooks/workflows/configuration during detection.
- Keep CI detection platform-neutral; GitHub Actions is one marker, not the capability identity.


Readiness findings respect detected capability rather than layout assumptions. The audit computes quality detection first, and the "Top-level test directory not detected." readiness info is emitted only when no test capability is detected by any supported mechanism. For Go modules (`go.mod`), tracked and non-ignored untracked package-local `*_test.go` files count as strong native test evidence. Git repositories use canonical inventory (`git ls-files --cached --others --exclude-standard`) filtered to `*_test.go` and excluding `.git`, `vendor`, `node_modules`, and generated/heavy directories, so `.gitignore` semantics are honored and a Git repository never falls through to an ignore-unaware walk. Only a non-Git directory uses the bounded two-directory-level, 512-directory-capped filesystem fallback. The Project Map may still report `Test directories: none` as truthful inventory; that fact alone is not a readiness deficiency. Node, Python, and build detection are unchanged (Tasks 0122, 0135).

Audit package-script and top-level-test readiness checks only treat the root manifest as a Node application when the runtime projection proves that role. Tooling-only Python/Go repositories therefore retain their application runtime and report APK/Node/pnpm as repository tooling without inheriting Node application readiness assumptions. Ambiguous manifests remain visible as ambiguous rather than being silently suppressed.
