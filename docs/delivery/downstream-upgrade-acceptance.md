# Downstream Upgrade and Legacy Migration Acceptance

Status: fixture-based acceptance record
Task: 0250
Date: 2026-11-05

This record separates three upgrade shapes and reuses the existing read-only doctor, adoption, compatibility, and lint surfaces. It does not add a migration engine, rewrite task history, modify downstream repositories, or claim that an unavailable private repository was tested.

## Verified inputs

- The repository's immutable v0.5.2 release note and post-release validation record are the current released evidence in this checkout.
- The downstream version observations in the task contract are treated as **unverified inputs** for this task unless a repository was available for inspection. No network or GitHub API query is part of this acceptance.
- The fixture acceptance test is `upgrade acceptance separates pinned, legacy, and unpinned installations` in `src/core/doctor/doctor.test.ts`. It covers a pinned declaration with a matched lock, a copied v0.3.1 legacy fixture with a current pin, and an unpinned external-installation instruction.

## Shape 1: pinned-tag upgrade

1. Record the declared pin from `package.json`, the resolved entry from the supported `pnpm-lock.yaml`, and the installed CLI identity separately. A matching pin and lock is reproducible metadata, not proof that a tag still resolves remotely or that the payload installs successfully.
2. Run `pnpm exec apk doctor` and inspect installation findings. Treat `pin-unresolved`, `installed-version-mismatch`, `local-payload-unavailable`, and launcher findings as stop conditions.
3. Run `pnpm exec apk adopt --preview` and review the proposed compatibility, ignore, and generated-file changes. Apply only the reviewed additive changes with `pnpm exec apk adopt --apply`.
4. Run `pnpm exec apk sync`; write generated instructions only after reviewing the exact paths. Do not overwrite customized files.
5. Run `pnpm exec apk lint --json`, `pnpm exec apk task deps <active-task>`, and the host repository's relevant checks.
6. Preserve active task baselines and evidence. A clean doctor/lint does not make stale candidate evidence current; revalidate affected verification and review evidence independently.

This is a tooling-pin upgrade. It does not require rewriting completed tasks or their history.

## Shape 2: legacy config and task-contract migration

1. Preserve task bytes, local evidence, and baselines before editing anything.
2. Run `pnpm exec apk adopt --preview` and inspect the config schema state, task-contract coverage, parser issues, and generated instruction changes.
3. Repair only materially incompatible task contracts with explicit owner, state, and mode decisions. Supported legacy `Verification commands` need no format rewrite. Do not guess that `in_progress` means `doing` or that `bugfix` is a Mode.
4. Apply the explicit config marker with `pnpm exec apk adopt --apply` when the preview is safe. A schema marker does not repair invalid task content.
5. Rerun adoption preview and `pnpm exec apk lint --json` until coverage is complete or the remaining limits are recorded.
6. Independently revalidate candidate/baseline-bound evidence after any contract edit. Never copy PASS records or promote historical evidence by assertion.

Legacy identity preferences are read-only observations. A configured `agentStyle: caveman` is preserved and never changed automatically.

## Shape 3: unpinned or external installation

1. Treat a globally available `apk`/`apkit` command, PATH entry, or separate manual installation as an external prerequisite, not clean-checkout evidence.
2. Inspect `doctor` and `adopt --preview` findings for `external-prerequisite`, `installation-undeclared`, `instructions-unknown`, launcher mismatch, or unresolved local invocation.
3. Document the exact source, version, acquisition, and launcher, or add a repository pin with a matching lock. Do not put `#main` in a repeatable project setup.
4. If the source or version cannot be established, stop and record the limitation. Do not claim reproducibility or end-to-end validation.

## Safe walkthrough and rollback

Use a disposable worktree or branch. Before applying, commit or otherwise preserve the exact pre-upgrade tree and local operational evidence. Review every preview change and keep unrelated application edits out of the upgrade checkpoint. If a check fails, stop rather than masking it by rewriting task history. Restore the reviewed pre-upgrade tooling files from the preserved branch/worktree and rerun `doctor`, `adopt --preview`, `lint`, and the host verification.

## Limitations

- Private or currently unavailable downstream repositories were not inspected here and are not claimed validated.
- Fixtures prove read-only classification and the documented sequence, not remote tag availability, dependency-registry integrity, or another machine's installation.
- This acceptance does not cover application-specific runtime behavior; the host repository must run its own relevant checks.
- Windows/macOS launcher and filesystem behavior was not exercised in this task.
