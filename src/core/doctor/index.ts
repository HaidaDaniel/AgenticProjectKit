import { execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { CONFIG_PATH, readAgenticConfigFile } from "../config/index.js";
import { listAgents } from "../agents/index.js";
import { syncAgentExports } from "../sync/index.js";
import { listTaskFiles } from "../tasks/index.js";

const execFileAsync = promisify(execFile);

export type DoctorLevel = "pass" | "warn" | "fail";

export interface DoctorCheck {
  level: DoctorLevel;
  label: string;
  message: string;
}

export interface DoctorResult {
  checks: DoctorCheck[];
  ok: boolean;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function readJson(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function gitCheck(rootDirectory: string): Promise<DoctorCheck[]> {
  try {
    await execFileAsync("git", ["--version"], { cwd: rootDirectory });
  } catch {
    return [{ level: "warn", label: "git", message: "git is not available" }];
  }

  try {
    await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: rootDirectory });
    return [{ level: "pass", label: "git", message: "inside git worktree" }];
  } catch {
    return [{ level: "warn", label: "git", message: "not inside git worktree" }];
  }
}

async function lockCheck(rootDirectory: string, taskDirectory: string): Promise<DoctorCheck> {
  const lockPath = join(rootDirectory, taskDirectory, ".apk.lock");
  try {
    const lock = await stat(lockPath);
    const stale = Date.now() - lock.mtimeMs > 5 * 60 * 1000;
    return stale
      ? { level: "fail", label: "task lock", message: "stale .apk.lock detected" }
      : { level: "warn", label: "task lock", message: ".apk.lock exists and may be active" };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { level: "pass", label: "task lock", message: "none" };
    }
    throw error;
  }
}

async function packageChecks(rootDirectory: string): Promise<DoctorCheck[]> {
  const raw = await readJson(join(rootDirectory, "package.json"));
  if (!raw || typeof raw !== "object") {
    return [{ level: "warn", label: "package", message: "package.json missing" }];
  }

  const scripts = "scripts" in raw && raw.scripts && typeof raw.scripts === "object"
    ? raw.scripts as Record<string, unknown>
    : {};
  const checks: DoctorCheck[] = [];

  for (const script of ["test", "lint", "typecheck", "build"]) {
    checks.push(script in scripts
      ? { level: "pass", label: `script:${script}`, message: "present" }
      : { level: "warn", label: `script:${script}`, message: "missing" });
  }

  return checks;
}

async function directoryHasFiles(path: string, suffix?: string): Promise<boolean> {
  try {
    const entries = await readdir(path);
    return suffix ? entries.some((entry) => entry.endsWith(suffix)) : entries.length > 0;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function runDoctor(rootDirectory: string): Promise<DoctorResult> {
  const checks: DoctorCheck[] = [];
  checks.push(...await gitCheck(rootDirectory));

  let taskDirectory = ".tasks";
  try {
    const configExists = await exists(join(rootDirectory, CONFIG_PATH));
    const config = await readAgenticConfigFile(rootDirectory);
    taskDirectory = config.taskDirectory;
    checks.push(configExists
      ? { level: "pass", label: "config", message: "ok" }
      : { level: "warn", label: "config", message: "missing; using defaults" });
  } catch (error: unknown) {
    checks.push({ level: "fail", label: "config", message: error instanceof Error ? error.message : String(error) });
  }

  try {
    const tasks = await listTaskFiles(rootDirectory, taskDirectory);
    checks.push(tasks.length > 0
      ? { level: "pass", label: "tasks", message: `${tasks.length} active task(s)` }
      : { level: "warn", label: "tasks", message: "no active task files" });
  } catch (error: unknown) {
    checks.push({ level: "fail", label: "tasks", message: error instanceof Error ? error.message.split("\n")[0] : String(error) });
  }

  const agents = await listAgents(rootDirectory);
  checks.push(agents.length > 0
    ? { level: "pass", label: "agents", message: `${agents.length} registered agent(s)` }
    : { level: "warn", label: "agents", message: "none registered" });

  checks.push(await lockCheck(rootDirectory, taskDirectory));

  try {
    const sync = await syncAgentExports(rootDirectory);
    checks.push(sync.hasDrift
      ? { level: "warn", label: "exports", message: `missing:${sync.missing.length} stale:${sync.stale.length}` }
      : { level: "pass", label: "exports", message: "in sync" });
  } catch (error: unknown) {
    checks.push({ level: "warn", label: "exports", message: error instanceof Error ? error.message : String(error) });
  }

  checks.push(...await packageChecks(rootDirectory));
  checks.push(await exists(join(rootDirectory, "README.md"))
    ? { level: "pass", label: "readme", message: "present" }
    : { level: "warn", label: "readme", message: "missing" });
  checks.push(await exists(join(rootDirectory, "LICENSE"))
    ? { level: "pass", label: "license", message: "present" }
    : { level: "warn", label: "license", message: "missing" });
  checks.push(await exists(join(rootDirectory, ".env.example"))
    ? { level: "pass", label: "env", message: ".env.example present" }
    : { level: "warn", label: "env", message: ".env.example missing" });
  checks.push(await directoryHasFiles(join(rootDirectory, ".github", "workflows"), ".yml")
    ? { level: "pass", label: "ci", message: "GitHub Actions present" }
    : { level: "warn", label: "ci", message: "GitHub Actions missing" });

  return {
    checks,
    ok: !checks.some((check) => check.level === "fail"),
  };
}

export function renderDoctor(result: DoctorResult): string {
  const lines = ["Doctor:"];
  for (const level of ["fail", "warn", "pass"] as const) {
    const checks = result.checks.filter((check) => check.level === level);
    lines.push(`${level}: ${checks.length}`);
    for (const check of checks) {
      lines.push(`- ${check.label}: ${check.message}`);
    }
  }
  lines.push(result.ok ? "Result: pass" : "Result: fail");
  lines.push("");
  return lines.join("\n");
}
