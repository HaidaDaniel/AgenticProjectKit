# Package Structure

The future source tree is expected to look roughly like this:

```txt
src/
  cli/
    index.ts
    commands/
      init.ts
      adopt.ts
      audit.ts
      mode.ts
      next-task.ts
      context.ts
      prompt.ts
      export.ts
      sync.ts
  core/
    config/
    modes/
    tasks/
    docs/
    templates/
    exporters/
    scanners/
  utils/
```

## Design intent

- Keep command handlers thin.
- Keep reusable logic in core modules.
- Keep scanning, templating, and exporting separated.
- Keep utilities small and dependency-light.

