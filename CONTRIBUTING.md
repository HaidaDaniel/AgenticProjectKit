# Contributing

Thank you for helping improve Agentic Project Kit. Keep proposals and pull requests
focused on one bounded outcome, and use the repository's task contract and checks when
the change belongs to an existing task.

## Start from a checkout

The source checkout requires Node.js `>=22.22.1` and pnpm `10.28.1`, as declared in
[`package.json`](package.json).

```sh
git clone https://github.com/HaidaDaniel/AgenticProjectKit.git
cd AgenticProjectKit
pnpm install --frozen-lockfile
pnpm exec tsx src/cli/index.ts --help
```

This source checkout does not install itself as a package executable. Run APK commands
here through `pnpm exec tsx src/cli/index.ts <command>`; for example,
`pnpm exec tsx src/cli/index.ts lint --json`. In a downstream repository where APK is
installed as a dev dependency, use `pnpm exec apkit`; `apk` and `agentic-project-kit`
remain compatibility aliases. The [CLI reference](docs/cli-commands.md) lists the public
commands.

## Propose a bounded change

- Search existing issues and task contracts before opening a new issue. Use the bug,
  feature, or documentation form under [GitHub issue templates](.github/ISSUE_TEMPLATE/).
- For an existing task, read its contract and dependencies in `.tasks/`, then follow the
  [task workflow](docs/task-system.md). Do not broaden its allowed files or acceptance
  criteria without updating the contract.
- For a proposal without a matching task, describe the problem, intended outcome, and
  smallest useful scope in the issue. An issue is a proposal, not a guarantee that work
  will be scheduled.
- Keep pull requests focused. Include the related issue or task when available and call
  out any user-visible documentation change.

The GitHub `good first issue` label is for work that has a bounded outcome and acceptance
criteria, can be started with public repository context, and has no unresolved dependency
or privileged-access requirement. Add or remove the label when those facts change; it is
not a promise of assignment, mentorship, or response time. Leave the label off when no
open issue meets those conditions.

## Run checks

Run every check declared by the task you are changing. For source changes, the standard
local quality lane is:

```sh
pnpm typecheck
pnpm lint
pnpm test
```

For task-contract and documentation changes, also run:

```sh
pnpm exec tsx src/cli/index.ts lint --json
git diff --check
```

Run additional coverage, build, or release checks when the task requires them or the
change affects those outputs. Record which commands passed in the pull request; explain
any required check that could not be run. The [testing strategy](docs/engineering/testing-strategy.md)
describes the repository's quality lanes and their limits.

## Pull requests and project policies

Use the [pull request template](.github/PULL_REQUEST_TEMPLATE.md) to summarize scope,
validation evidence, and documentation impact. Open a branch or fork pull request through
GitHub; no separate contribution portal is required.

This repository is licensed under the [MIT License](LICENSE). No separate CLA or DCO
step is documented. The repository has not adopted a Code of Conduct; these contribution
notes do not create one or define a reporting or response process.
