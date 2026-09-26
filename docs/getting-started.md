# Getting Started

This guide takes a repository from an exact APK install to one completed sample task. Commands use the package-local `apkit` executable; APK does not launch an AI agent for you.

## Prerequisites and support boundary

Have Git, Node.js, and pnpm available. The package declares Node.js `>=22.22.1`; the evidence-backed release combination is Node.js `22.22.1`, pnpm `10.28.1`, and the Ubuntu CI runner. The declared Node range is not a full compatibility matrix: other Node or pnpm versions and end-to-end macOS/Windows installs are unverified. A first install needs Git and network access. See the [maturity and compatibility policy](product/maturity-and-compatibility.md).

## 1. Install the exact release in the target repository

From the repository root, install the validated release tag as a development dependency:

```bash
pnpm add -D agentic-project-kit@git+https://github.com/HaidaDaniel/AgenticProjectKit.git#v0.4.7
```

Inspect `package.json` and `pnpm-lock.yaml` before committing. The manifest should name the exact `v0.4.7` tag, and the lockfile should record its resolved Git commit. In the clean-directory walkthrough recorded below, pnpm 10.28.1 resolved it to `2797556344eb25cc34d3f51afbe10532147aca85`. If the repository had no manifest, pnpm created both files. For a tooling-only manifest, set `"private": true` if it must not be published, and add `node_modules/` to `.gitignore` when it is not already ignored.

Confirm the saved lock and package-local command:

```bash
pnpm install --frozen-lockfile
pnpm exec apkit --help
```

`pnpm exec` selects the binary from this repository's installed dependency. For upgrade, recovery, or install-option details, use the [exact-pin install guide](../README.md#install-apk-in-another-repository). Do not replace the tag with `#main` for a repeatable project setup.

## 2. Initialize or adopt the repository

For a new project, create the starter files:

```bash
pnpm exec apkit init
```

In the walkthrough this printed `Initialized Agentic Project Kit` and `Created 21 file(s).` The exact count may change by release.

For an existing project, first preview and inspect every proposed change, then apply adoption:

```bash
pnpm exec apkit adopt --preview
pnpm exec apkit adopt --apply
```

`init` creates project docs, `.agentic/config.json`, `.tasks/0001-start.md`, `.gitignore`, and `AGENTS.md`. Adoption preserves existing docs and custom instructions and creates only missing kit files plus an explicit compatibility marker when required. Inspect `git status --short` and the generated files. APK's full common policy is `AGENTS.md`; `CLAUDE.md` and `GEMINI.md` are thin imports, while Codex, OpenCode, and Cursor read `AGENTS.md` directly. See [agent exporter behavior](agent-exporters.md).

Check generated instruction files. Only write when they are missing or stale and you have reviewed those paths:

```bash
pnpm exec apkit sync
```

In the v0.4.7 clean-directory run, the first check reported stale `AGENTS.md` and missing `CLAUDE.md` and `GEMINI.md`; `sync --write` updated or created those files, and the next check reported all three current. Review the resulting diff before committing. If the first check already says all generated files are current, skip `--write`.

When the check reports generated files that you reviewed and want to update, write and check them again:

```bash
pnpm exec apkit sync --write
pnpm exec apkit sync
```

Inspect the workflow state:

```bash
pnpm exec apkit status
```

An initialized repository starts in `mvp` mode with task `0001 Start Project` in `todo`. It is a planning prompt, not a completed project task; status may show that it still needs verification evidence. Use it to define the next implementation task. Status and the gate report current evidence instead of implying that setup alone completed work.

After syncing instructions, the walkthrough's status began with:

```text
Mode: mvp
Config: ok
Tasks: todo:1, doing:0, review:0, done:0, blocked:0, canceled:0, archived:0
Next task: 0001 Start Project
Generated instructions: current:3, missing:0, stale:0
```

The sample below creates task `0002` directly and leaves the starter planning task open; in your project, you can instead use `0001` to define the first real task.

Before starting task work, commit the reviewed installation and initialization files so verification has a Git baseline. Stage only the paths you inspected. In an existing project, keep unrelated application changes out of that checkpoint.

## 3. Create and review a task contract

This sample adds one short project note. `--template docs` supplies documentation-oriented context, steps, and acceptance criteria; the explicit verification flag uses APK's local lint instead of assuming the application has a test script.

```bash
pnpm exec apkit task create \
  --template docs \
  --title "Write the first project note" \
  --goal "Add a short note that describes the project." \
  --scope docs \
  --allowed docs/project-note.md \
  --verification "pnpm exec apkit lint --json"
```

Expected result:

```text
Created: .tasks/0002-write-the-first-project-note.md
```

The number depends on the repository's existing tasks. Read the new task file and confirm its goal, allowed path, acceptance criteria, and verification command. Commit the reviewed task contract before claiming it.

Register the agent that will own the work, then claim the task:

```bash
pnpm exec apkit agent register --id codex-a --platform codex --model gpt-6
pnpm exec apkit claim 0002 --owner codex-a
```

Replace the sample agent ID, platform, and model with the identity used in your environment. The task changes to `doing` and records the owner. For the sample above, the output is:

```text
Task: 0002
State: doing
Owner: codex-a
```

## 4. Prepare the implementation handoff

Ask APK for the implementation package and prompt:

```bash
pnpm exec apkit work 0002 --owner codex-a --target codex --role implement
```

The output includes a run ID and paths to `package.json`, `metadata.json`, and `activation.json` under `.agentic/sessions/work/0002/<run-id>/`, followed by the task prompt and next-step commands. Give the prompt/package to the selected agent. APK prepares and records the handoff; it does not start Codex, OpenCode, or another runtime. The rendered prompt contains the task's allowed paths, acceptance criteria, and verification contract.

The v0.4.7 `work` output in this walkthrough printed a follow-up command using the compatibility alias `apk`. That alias remains available, but `apkit` is the canonical public name; continue with the equivalent `pnpm exec apkit` commands shown here.

The sample task allows only `docs/project-note.md`. After the agent creates and reviews that file, commit the task-owned implementation change before final verification:

```markdown
# Project note

This repository keeps project context and work plans alongside the code.
```

Stage only the implementation paths for that commit. Keep the task's lifecycle change separate for the completion bookkeeping after `done`.

## 5. Verify, review when required, gate, and finish

Run the declared verification with the registered owner:

```bash
pnpm exec apkit task verify 0002 --owner codex-a
```

For this sample, the expected result includes `File scope: pass`, `check-1: pass`, and `Result: pass`. Verification evidence is bound to the task and current candidate.

If policy or the gate requires an independent review, first move the verified task to review. Use a different registered identity for the reviewer:

```bash
pnpm exec apkit agent register --id codex-reviewer --platform codex --model gpt-6
pnpm exec apkit review 0002 --owner codex-a
pnpm exec apkit review 0002 --reviewer codex-reviewer --prompt
```

The prompt command prints a `Review run: <review-run-id>`. Give that exact prompt and candidate to the independent reviewer. After it inspects the candidate, record its outcome with the printed run ID:

```bash
pnpm exec apkit review 0002 \
  --reviewer codex-reviewer \
  --review-run <review-run-id> \
  --result pass
```

If the result is `changes_requested`, make the requested fix, commit it, rerun verification, and prepare a fresh review. Low-risk tasks such as this sample do not require an independent reviewer.

Preview the same completion gate that `done` will enforce, then complete the task:

```bash
pnpm exec apkit task gate 0002
pnpm exec apkit done 0002 --owner codex-a
```

For the sample, gate output includes `Gate: pass` and `Review: independent review is not required`; `done` reports `State: done`. Commit the resulting task-file lifecycle update separately if it is tracked. Do not amend the implementation commit after candidate-bound verification or review evidence exists. APK never stages or commits Git changes for you; see the [task lifecycle rules](task-system.md#successful-task-commit-hygiene).

After this walkthrough, `docs/project-note.md` and task `0002` are complete. A fresh `init` also leaves its planning task `0001 Start Project` in `todo` until you use it to define the project's next real task; completing the sample does not claim the whole repository is ready.

## Walkthrough record

The flow above was run on 2026-09-26 in a clean temporary Git repository. pnpm 10.28.1 created `package.json` and `pnpm-lock.yaml` from the exact tag; the lock recorded the commit shown in step 1. `init` created 21 files, and after generated-file sync the repository contained `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`. The task contract was `.tasks/0002-write-the-first-project-note.md`; the committed output was `docs/project-note.md`. Local verification passed one required lint check, the gate passed with no review required, and `done` recorded task `0002` as complete. The walkthrough host used Node.js 24.14.0; that version is not individually validated by the current compatibility policy, so this observation does not extend the documented support boundary.

For APK source development rather than use inside an application repository, follow the separate [contributor quickstart](../README.md#contributor-quickstart-from-source).
