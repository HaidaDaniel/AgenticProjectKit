#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RELEASE_TAG = "v0.4.7";
const PACKAGE_SPEC = `agentic-project-kit@git+https://github.com/HaidaDaniel/AgenticProjectKit.git#${RELEASE_TAG}`;
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SCENARIOS = ["greenfield", "brownfield", "local-first"];
const PREFIX = "apk-public-readiness-";
const OWNER = "showcase-agent";
const TOOLCHAIN = "pnpm@10.28.1";

process.env.PATH = [dirname(process.execPath), process.env.PATH].filter(Boolean).join(delimiter);

function isWithin(parent, child) {
  const path = relative(parent, child);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

function assertOutside(path, boundary, label) {
  if (isWithin(boundary, path)) {
    throw new Error(`Refusing to use a showcase directory inside ${label}: ${path}`);
  }
}

function command(binary, args, cwd, allowedExitCodes = [0]) {
  const result = spawnSync(binary, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...process.env, CI: "1" },
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.error || !allowedExitCodes.includes(result.status ?? -1)) {
    const invocation = [binary, ...args].join(" ");
    throw new Error(`${invocation} failed in ${cwd}\n${result.error ?? output}`);
  }
  return { output, status: result.status ?? 0 };
}

function pnpm(cwd, ...args) {
  const binary = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  return command(binary, args, cwd);
}

function git(cwd, ...args) {
  return command("git", args, cwd);
}

function apkit(cwd, ...args) {
  return pnpm(cwd, "exec", "apkit", ...args);
}

async function exists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

async function status(cwd) {
  return git(cwd, "status", "--porcelain", "--untracked-files=all").output;
}

async function prepareConsumer(workspace, name, seed = {}) {
  const cwd = join(workspace, name);
  await mkdir(cwd, { recursive: true });
  await writeFile(
    join(cwd, "package.json"),
    `${JSON.stringify(
      {
        name: `apk-showcase-${name}`,
        private: true,
        packageManager: TOOLCHAIN,
      },
      null,
      2,
    )}\n`,
  );
  const pnpmVersion = pnpm(cwd, "--version").output.trim();
  if (pnpmVersion !== "10.28.1") throw new Error(`Expected pnpm 10.28.1, got ${pnpmVersion}`);
  for (const [path, content] of Object.entries(seed)) {
    const target = join(cwd, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }

  pnpm(cwd, "add", "--save-dev", PACKAGE_SPEC);
  pnpm(cwd, "install", "--offline", "--frozen-lockfile");

  const manifest = JSON.parse(await readFile(join(cwd, "package.json"), "utf8"));
  const pin = manifest.devDependencies?.["agentic-project-kit"];
  const lock = await readFile(join(cwd, "pnpm-lock.yaml"), "utf8");
  if (!String(pin).includes(`#${RELEASE_TAG}`) || !lock.includes(RELEASE_TAG)) {
    throw new Error(`${name} does not contain the exact ${RELEASE_TAG} package pin`);
  }
  return cwd;
}

function initializeGit(cwd) {
  git(cwd, "init", "-q");
  git(cwd, "config", "user.name", "APK Showcase");
  git(cwd, "config", "user.email", "apk-showcase@example.invalid");
}

function commit(cwd, message, ...paths) {
  git(cwd, "add", "--", ...paths);
  git(cwd, "commit", "-q", "-m", message);
}

async function removeOwnedWorkspace(workspace, base, repository, home, expectedRunId) {
  const resolvedWorkspace = await realpath(workspace);
  const marker = await readFile(join(resolvedWorkspace, ".apk-public-readiness-owned"), "utf8");
  if (
    resolvedWorkspace === base ||
    !isWithin(base, resolvedWorkspace) ||
    !basename(resolvedWorkspace).startsWith(PREFIX) ||
    (expectedRunId && marker !== `${expectedRunId}\n`) ||
    !/^[0-9a-f-]{36}\n$/.test(marker)
  ) {
    throw new Error(`Refusing unsafe cleanup of ${workspace}`);
  }
  assertOutside(resolvedWorkspace, repository, "the repository");
  assertOutside(resolvedWorkspace, home, "the user home");
  await rm(resolvedWorkspace, { recursive: true });
}

function requireFile(cwd, path) {
  return readFile(join(cwd, path), "utf8");
}

async function assertUserFilesPreserved(cwd, userFiles) {
  for (const [path, content] of Object.entries(userFiles)) {
    if (path === ".gitignore") continue;
    if ((await requireFile(cwd, path)) !== content) throw new Error(`adoption changed user-managed ${path}`);
  }
  const ignore = await requireFile(cwd, ".gitignore");
  if (!ignore.startsWith(userFiles[".gitignore"])) {
    throw new Error("adoption replaced the existing .gitignore content instead of appending rules");
  }
}

async function runGreenfield(workspace) {
  const cwd = await prepareConsumer(workspace, "greenfield");
  apkit(cwd, "init");

  for (const path of [".gitignore", "AGENTS.md", ".agentic/config.json", ".tasks/0001-start.md", "docs/project.md"]) {
    if (!(await exists(join(cwd, path)))) throw new Error(`init did not create ${path}`);
  }

  apkit(cwd, "sync", "--write");
  apkit(cwd, "sync");
  initializeGit(cwd);
  commit(cwd, "showcase: initialize greenfield project", ".gitignore", "AGENTS.md", "CLAUDE.md", "GEMINI.md", ".agentic", ".tasks", "docs", "package.json", "pnpm-lock.yaml");

  apkit(
    cwd,
    "task",
    "create",
    "--template",
    "docs",
    "--title",
    "Write the first project note",
    "--goal",
    "Add a short note describing the project.",
    "--scope",
    "docs",
    "--allowed",
    "docs/project-note.md",
    "--verification",
    "pnpm exec apkit lint --json",
  );
  const taskPath = ".tasks/0002-write-the-first-project-note.md";
  if (!(await exists(join(cwd, taskPath)))) throw new Error(`task create did not write ${taskPath}`);
  commit(cwd, "showcase: add the bounded note task", taskPath);

  apkit(cwd, "agent", "register", "--id", OWNER, "--platform", "codex", "--model", "gpt-6");
  apkit(cwd, "claim", "0002", "--owner", OWNER);
  await writeFile(join(cwd, "docs/project-note.md"), "# Project note\n\nThis project keeps its context and work plans in the repository.\n");
  commit(cwd, "showcase: write the project note", "docs/project-note.md", taskPath);
  apkit(cwd, "task", "verify", "0002", "--owner", OWNER);
  apkit(cwd, "task", "gate", "0002");
  apkit(cwd, "done", "0002", "--owner", OWNER);
  commit(cwd, "showcase: close the note task", taskPath);

  const beforeRepeat = await status(cwd);
  apkit(cwd, "init");
  const afterRepeat = await status(cwd);
  const task = await requireFile(cwd, taskPath);
  const note = await requireFile(cwd, "docs/project-note.md");
  if (beforeRepeat !== afterRepeat || !task.startsWith("# Task 0002") || !task.includes("State: done") || !note.includes("repository.")) {
    throw new Error("the greenfield rerun changed files or lost its completed task state");
  }
  return "PASS greenfield: exact v0.4.7 pin; task 0002 done; repeated init left the worktree unchanged.";
}

async function runBrownfield(workspace) {
  const userFiles = {
    "README.md": "# Existing Go service\n\nThis README is maintained by the application team.\n",
    "AGENTS.md": "# Existing agent instructions\n\nKeep the service's established review process.\n",
    "docs/project.md": "# Existing project notes\n\nPreserve this application-owned description.\n",
    ".gitignore": "node_modules/\n",
    "go.mod": "module example.invalid/apk-showcase-brownfield\n\ngo 1.22\n",
    "main.go": "package main\n\nfunc main() {}\n",
  };
  const cwd = await prepareConsumer(workspace, "brownfield", userFiles);
  initializeGit(cwd);
  commit(cwd, "showcase: seed brownfield project", ...Object.keys(userFiles), "package.json", "pnpm-lock.yaml");

  const beforePreview = await status(cwd);
  apkit(cwd, "adopt", "--preview");
  if ((await status(cwd)) !== beforePreview) throw new Error("brownfield preview changed the worktree");

  apkit(cwd, "adopt", "--apply");
  const firstApply = await status(cwd);
  await assertUserFilesPreserved(cwd, userFiles);
  if (!(await exists(join(cwd, ".agentic/config.json"))) || !(await exists(join(cwd, "docs/adoption-report.md")))) {
    throw new Error("adoption did not create the expected repository-local kit files");
  }

  apkit(cwd, "adopt", "--preview");
  apkit(cwd, "adopt", "--apply");
  const secondApply = await status(cwd);
  if (firstApply !== secondApply) throw new Error("the second brownfield apply added or changed files");
  await assertUserFilesPreserved(cwd, userFiles);
  return "PASS brownfield: preview was read-only; apply preserved user files; second apply added no changes.";
}

async function runLocalFirst(workspace) {
  const userFiles = {
    ".gitignore": "node_modules/\n",
    "go.mod": "module example.invalid/apk-showcase-local-first\n\ngo 1.22\n",
    "main.go": "package main\n\nfunc main() {}\n",
  };
  const cwd = await prepareConsumer(workspace, "local-first", userFiles);
  initializeGit(cwd);
  commit(cwd, "showcase: seed local-first Go project", ...Object.keys(userFiles), "package.json", "pnpm-lock.yaml");

  apkit(cwd, "adopt", "--preview");
  if ((await status(cwd)) !== "") throw new Error("local-first preview changed the worktree");
  pnpm(cwd, "install", "--offline", "--frozen-lockfile");
  apkit(cwd, "adopt", "--apply");
  apkit(cwd, "lint", "--json");
  apkit(cwd, "status");
  const firstApply = await status(cwd);

  pnpm(cwd, "install", "--offline", "--frozen-lockfile");
  apkit(cwd, "adopt", "--preview");
  apkit(cwd, "adopt", "--apply");
  apkit(cwd, "lint", "--json");
  apkit(cwd, "status");
  const secondApply = await status(cwd);
  if (firstApply !== secondApply) throw new Error("local-first rerun added or changed files");
  await assertUserFilesPreserved(cwd, userFiles);
  return "PASS local-first: exact v0.4.7 pin; cached offline installs and local APK commands passed after acquisition; rerun added no changes.";
}

function parseArguments(args) {
  const parsed = { scenario: "all", keep: false, tempDir: tmpdir(), cleanupPath: undefined };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--help") {
      console.log("Usage: node examples/public-readiness/smoke.mjs [--scenario all|greenfield|brownfield|local-first] [--temp-dir <existing-directory>] [--keep]");
      process.exit(0);
    }
    if (value === "--keep") parsed.keep = true;
    else if (value === "--scenario") parsed.scenario = args[++index];
    else if (value === "--temp-dir") parsed.tempDir = args[++index];
    else if (value === "--cleanup") parsed.cleanupPath = args[++index];
    else throw new Error(`Unknown option: ${value}`);
  }
  if (parsed.cleanupPath && (parsed.keep || parsed.scenario !== "all")) {
    throw new Error("--cleanup cannot be combined with --keep or --scenario");
  }
  if (parsed.scenario !== "all" && !SCENARIOS.includes(parsed.scenario)) {
    throw new Error(`Unknown scenario: ${parsed.scenario}`);
  }
  if (!parsed.tempDir || parsed.tempDir.startsWith("--")) throw new Error("--temp-dir requires an existing directory path");
  return parsed;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const base = await realpath(options.tempDir);
  const repository = await realpath(REPO_ROOT);
  const home = await realpath(homedir());
  assertOutside(base, repository, "the repository");
  assertOutside(base, home, "the user home");

  if (options.cleanupPath) {
    await removeOwnedWorkspace(options.cleanupPath, base, repository, home);
    console.log(`Cleaned fixture directory: ${basename(options.cleanupPath)}`);
    return;
  }

  const workspace = await mkdtemp(join(base, PREFIX));
  const runId = randomUUID();
  const markerPath = join(workspace, ".apk-public-readiness-owned");
  await writeFile(markerPath, `${runId}\n`);

  try {
    const selected = options.scenario === "all" ? SCENARIOS : [options.scenario];
    const results = [];
    for (const scenario of selected) {
      if (scenario === "greenfield") results.push(await runGreenfield(workspace));
      else if (scenario === "brownfield") results.push(await runBrownfield(workspace));
      else results.push(await runLocalFirst(workspace));
    }
    for (const result of results) console.log(result);
  } finally {
    if (options.keep) {
      console.log(`Kept fixture directory: ${workspace}`);
    } else {
      await removeOwnedWorkspace(workspace, base, repository, home, runId);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
