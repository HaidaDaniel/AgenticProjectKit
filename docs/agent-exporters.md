# Agent Exporters

Agent exporters convert one neutral policy source into tool-specific instruction files.

The exported instructions should default to `caveman` style: terse, technical, and low-fluff.

## Source of truth

The internal docs and config should be the durable source of truth.

Exporter files are derived artifacts and should not become the real policy source.

## Implemented outputs

- `AGENTS.md`
- `.codex/instructions.md`
- `.opencode/AGENTS.md`
- `.cursor/rules/*.mdc`
- `CLAUDE.md`
- `GEMINI.md`

## Planned outputs

- `.github/copilot-instructions.md`

## Export rules

- Export from neutral policy content, not hand-maintained duplicates.
- Keep exporter output concise and tool-appropriate.
- Preserve the same behavioral rules across tools.
- Allow tool-specific formatting when needed, but not tool-specific policy drift.
- Regenerate exported files from the same internal policy documents.
- Keep style defaults consistent, even when file formats differ.

## Tool adaptation

- Cursor rules should be split into small focused files.
- Codex instructions should emphasize task discipline and context selection.
- OpenCode instructions should stay terse and operational.
- Generic agent files should remain readable by humans first.
- Claude Code should use `CLAUDE.md` as a thin adapter that imports `AGENTS.md`.
- Gemini CLI should use `GEMINI.md` with the same shared rules and context list.

## Worker handoff contract

The work loop exposes a vendor-neutral `apk-worker-v1` package and result contract. A package carries task identity, selected context, allowed and forbidden paths, acceptance criteria, verification requirements, output/evidence expectations, role, and run provenance. Supported roles are `implement`, `review`, `fix`, and `verify`; the role is independent from the target exporter or harness.

Workers return a JSON-compatible result with `taskId`, `role`, `runId`, `status`, optional commit/diff identities, evidence references, review findings, provenance identities, and a bounded completion/failure reason. Results use `completed`, `failed`, or `changes_requested`; failed and change-requested results must explain why. The core validates and serializes this contract without importing any vendor SDK.

Use `apk work <task-id> --owner <agent-id> --target <agent> --role <implement|review|fix|verify>` to select a role. Codex and OpenCode exports include the same contract guidance while retaining tool-specific formatting.
