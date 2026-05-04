# CLI Commands

The CLI is named `apk`.

## Implemented v0.1 commands

- `apk init` - create the kit structure in a new repository.
- `apk adopt` - add the kit to an existing repository.
- `apk mode <mode>` - set or inspect the current operating mode.
- `apk next-task` - choose the next task to work on.
- `apk context <task-id>` - output the context files needed for a task.
- `apk prompt <agent> --task <task-id>` - generate an agent-specific prompt.
- `apk export <agent> [--force]` - export instructions for a specific agent tool.

## Planned later commands

- `apk audit` - inspect a repository and report documentation gaps.
- `apk sync` - synchronize generated files from internal policy.

## Example usage

```bash
apk init
apk mode mvp
apk next-task
apk context 0001
apk prompt codex --task 0001
apk export cursor --force
```

`apk export` skips existing files by default. Use `--force` to overwrite generated instruction files.

## Supported values

Operating modes:

- `discovery`
- `mvp`
- `product`
- `production`
- `maintenance`
- `audit`
- `adopt`

Prompt agents:

- `agents`
- `codex`
- `opencode`
- `cursor`

Export targets:

- `agents`
- `codex`
- `opencode`
- `cursor`

## Behavior principles

- Commands should be deterministic.
- Commands should read the repository state, not chat history.
- Commands should make the selected context explicit.
- Commands should be usable in both greenfield and brownfield repos.
