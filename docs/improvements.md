# Improvement Proposals

## Problem 1: Accumulation of Done Tasks

All 40 task files currently live in `.tasks/`. As the project grows, this folder will become cluttered and slow to scan.

### Proposed Solution: Task Archiving

- New command `apk archive <task-id>` — moves a single done task to `.tasks/archive/`
- `apk archive --all` — moves all done tasks at once
- `apk tasks` reads only `.tasks/*.md` (active tasks) by default
- `apk tasks --include archived` — includes archived tasks in output
- `listTaskFiles` gets an optional parameter to exclude archive directory
- `selectNextTask` must still check `.tasks/archive/` for completed tasks when evaluating `dependsOn`

### Scope

- Modify `listTaskFiles` to support archive exclusion
- Add `apk archive` CLI command
- Update `selectNextTask` to resolve done tasks from archive for dependency checks
- Estimated: 2–3 tasks

---

## Problem 2: Execution Order and Dependencies

Current sorting is strictly by numeric task ID (`taskSortValue`). `selectNextTask` checks `dependsOn` only to verify dependencies are done, but does not perform topological ordering.

Issues:
1. No topological sort — if task 0050 depends on 0055, the lower-numbered task is still suggested first
2. No visualization of dependency graph — no way to see execution order at a glance
3. No explicit order enforcement at task creation — `Depends on: none` is default, order is implied by numbering alone
4. Tokens and time spent each session figuring out the optimal execution order

### Proposed Solution

1. **New field `Priority: high|medium|low`** — optional priority that influences sorting in `apk tasks` and `apk next-task`
2. **Topological sort in `selectNextTask`** — replace "lowest ID" logic with topological sort based on `dependsOn`. This resolves cross-dependency ordering
3. **New command `apk task deps <task-id>`** — shows dependency tree (what depends on this task, what this task depends on)
4. **Task creation enforces order** — when creating tasks, `Depends on` and `Priority` are explicitly set. Agent cannot start until the dependency graph is valid
5. **`apk next-task` respects lane/priority** — instead of lowest ID, select by lane + priority + dependency resolution

### Scope

- Topological sort utility function
- Refactor `selectNextTask` to use topological ordering
- `apk task deps` command
- Add `Priority` field to task schema, parser, and renderer
- Update task templates to include `Priority` and `Depends on` defaults
- Estimated: 4–5 tasks

---

## Future Improvements (Post v0.3)

Ordered by priority:

1. **Archive + Execution Order** — foundational, required before scaling beyond current size
2. **`apk task create`** — no interactive task creation exists today. Need a wizard or JSON input to generate task files with validation
3. **LLM-powered task generation** — `apk plan <description>` — AI generates a set of tasks with dependencies, priorities, and context files
4. **`next-task` with lane/priority awareness** — current selection is ID-only; better to select by lane + priority + dependency resolution
5. **Cross-repo collaboration** — shared tasks, subrepo orchestration
6. **Web dashboard** — only after CLI becomes unwieldy with 100+ tasks
