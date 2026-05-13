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
