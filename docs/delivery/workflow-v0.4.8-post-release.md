# v0.4.8 post-release tag validation

This record was written after publication on `main`. It is separate from the immutable
`v0.4.8` release note and does not modify the tagged candidate.

## Immutable release identity

- Annotated tag object: `991f3793c09cbe016b07e16e7b0713843b474b06`.
- Tag `v0.4.8` peels to candidate commit `c0d1e27b958f3543f4a8746b6a269dad275f400e` and tree `110b6ddbd9bcf20153f76cfccc3a3e12371cb55f`.
- Exact-SHA GitHub Actions Quality run [37637281949](https://github.com/HaidaDaniel/AgenticProjectKit/actions/runs/37637281949) completed successfully for `c0d1e27b958f3543f4a8746b6a269dad275f400e` before tag creation.
- The tag and tagged release note remain unchanged after validation.

## Actual-tag cold install

- A fresh consumer with a fresh pnpm store installed `github:HaidaDaniel/AgenticProjectKit#v0.4.8`.
- Installed metadata reported `agentic-project-kit@0.4.8`; `apkit`, `apk`, and `agentic-project-kit` all mapped to `dist/cli/index.js`.
- The tagged payload contains `LICENSE`, `dist/cli/index.js`, and all six portable skill assets: `apk-milestone-semantic-audit`, `apk-project-grill`, `apk-prototype`, `apk-task-author`, `apk-task-grill`, and `apk-task-split`.

## Downstream and self-adoption smoke

- The installed tag CLI ran in a disposable exact-tag tree. `adopt --preview` wrote nothing and proposed `docs/project-map.md`, `docs/adoption-report.md`, and free Task 0204.
- `adopt --apply` created those three files and did not update existing files. `sync` passed; `lint --json` reported zero errors; `doctor` and `status` completed successfully.
- These observations came from the released tag in disposable directories and did not modify `main`, the tag, or the tagged release note.

## Temporal boundary

The candidate note contains only pre-tag-known facts. This file contains post-tag identity,
cold-install, payload, and adoption observations; it is intentionally stored separately.
