# Risks

## Risk: scope creep

The project can expand into a general-purpose platform too early.

Mitigation:

- keep v0.1 narrow;
- use task files with explicit allowed edits;
- record major decisions in `docs/decisions.md`.

## Risk: duplicated policy

Exported agent files may drift from the neutral source.

Mitigation:

- generate exports from shared internal policy;
- treat exported files as derived artifacts.

## Risk: overstuffed prompts

Agents may receive too much repository context.

Mitigation:

- use the context system;
- keep task files explicit;
- prefer the smallest sufficient context set.

## Risk: task ambiguity

Tasks that are too broad are hard for agents to complete safely.

Mitigation:

- keep tasks atomic;
- define acceptance criteria and verification commands;
- limit file access.

