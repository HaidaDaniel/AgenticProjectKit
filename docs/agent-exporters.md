# Agent Exporters

Agent exporters convert one neutral policy source into tool-specific instruction files.

The exported instructions should default to `caveman` style: terse, technical, and low-fluff.

## Source of truth

The internal docs and config should be the durable source of truth.

Exporter files are derived artifacts and should not become the real policy source.

## Implemented outputs

`AGENTS.md` is the only full common-policy generated export. Two harnesses need
a thin native import adapter because they do not read `AGENTS.md` directly:

- `AGENTS.md` - full neutral policy, consumed directly by Codex, OpenCode and Cursor.
- `CLAUDE.md` - thin Claude Code adapter: `@AGENTS.md` import only.
- `GEMINI.md` - thin Gemini CLI adapter: `@./AGENTS.md` import only.

Codex, OpenCode and Cursor read `AGENTS.md` in the project root and in nested
directories, so no second common-policy file is generated for them. No
filesystem symlinks are used; every generated file is a portable regular text
file.

## Removed outputs and safe migration

Earlier APK versions generated `.codex/instructions.md`,
`.opencode/AGENTS.md`, and `.cursor/rules/*.mdc`. These are obsolete because the
affected harnesses now consume `AGENTS.md` directly:

- `apk export --report-legacy` lists obsolete generated files present in a repository.
- `apk export --cleanup-legacy` removes only files whose normalized content exactly matches the known legacy rendering; customized files are preserved and reported.
- A filename alone is never proof. Any file that differs from the known legacy rendering is treated as customized and left untouched.

## Export rules

- Export from neutral policy content, not hand-maintained duplicates.
- `NeutralAgentPolicy` plus repository docs remain the internal source of truth; `AGENTS.md` is a generated rendering, not a handwritten policy source.
- Keep exporter output concise and tool-appropriate.
- Preserve the same behavioral rules across tools.
- Adapt only the file name and native import syntax; do not duplicate policy.
- Regenerate exported files from the same internal policy documents.
- Keep style defaults consistent, even when file formats differ.

## Tool adaptation

- APK is the canonical full export; every harness either reads it directly (Codex, OpenCode, Cursor) or imports it through a thin adapter (Claude, Gemini).
- Claude Code should use `CLAUDE.md` as a thin adapter that imports `AGENTS.md` with `@AGENTS.md`.
- Gemini CLI should use `GEMINI.md` as a thin adapter that imports `AGENTS.md` with `@./AGENTS.md`.

## Worker handoff contract

The work loop exposes a vendor-neutral `apk-worker-v1` package and result contract. A package carries task identity, selected context, allowed and forbidden paths, acceptance criteria, verification requirements, output/evidence expectations, role, and issued/input provenance. Supported roles are `implement`, `review`, `fix`, and `verify`; the role is independent from the target exporter or harness. APK persists the exact package and immutable issuance metadata under `.agentic/sessions/work/<task-id>/<run-id>/` using a temporary-directory plus atomic-rename handoff, then writes an activation marker last; harnesses should consume that serialized package rather than reconstructing it.

Workers return a JSON-compatible result with `taskId`, `role`, `runId`, `status`, optional commit/diff identities, evidence references, review findings, output-candidate provenance, and a bounded completion/failure reason. Results use `completed`, `failed`, or `changes_requested`; failed and change-requested results must explain why. For implement/fix, APK captures the output candidate at result submission while retaining the issued candidate through package metadata. For review, output provenance must match the issued prepared subject. The core validates and serializes this contract without importing any vendor SDK.

Use `apk work <task-id> --owner <agent-id> --target <agent> --role <implement|review|fix|verify> --json` to select a role and consume the machine-readable package. Omit `--role` only when APK should resolve the next role from current canonical evidence. Run IDs must remain safe compact path segments. Review packages reference a prepared, immutable review subject; review results must be returned with the issued run ID and role only after the package is activated. The canonical `AGENTS.md` export includes this contract guidance; thin adapters import it rather than duplicating it.

Worker completion is orchestration evidence, not proof for a declared report/live/benchmark/manual/CI/artifact/evidence requirement. For verification, run the canonical APK check workflow after the worker result. For review, return the worker result only after inspecting the exact prepared subject; APK performs freshness and registered-reviewer validation.
