import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { ProjectTask, TaskVerificationCheck } from "./index.js";

export const PACKAGED_DIST_CHECK_ID = "build-current";
export const PACKAGED_DIST_CHECK_COMMAND = 'pnpm build && test -z "$(git status --porcelain --untracked-files=all -- dist)"';

function normalizeRepoPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

function pathPatternRegex(pattern: string): RegExp {
  let source = "";
  const normalized = normalizeRepoPath(pattern);
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char === "*" && normalized[index + 1] === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else {
      source += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
}

export function taskPathPatternMatches(pattern: string, path: string): boolean {
  return pathPatternRegex(pattern).test(normalizeRepoPath(path));
}

/** Conservatively detect forbidden globs that can cover any package output below dist/. */
export function taskPathPatternMayMatchDistOutput(pattern: string): boolean {
  const normalized = normalizeRepoPath(pattern);
  const separator = normalized.indexOf("/");
  if (separator < 0) return false;
  return pathPatternRegex(normalized.slice(0, separator)).test("dist");
}

/** The repository packages compiled TypeScript and recursively copied Handlebars assets. */
export function isPackagedInputPath(path: string): boolean {
  const normalized = normalizeRepoPath(path);
  if (!normalized.startsWith("src/")) return false;
  if (normalized.endsWith(".test.ts")) return false;
  return normalized.endsWith(".ts") || normalized.endsWith(".hbs");
}

/** Conservatively match task globs that may include a compiled source or copied asset. */
export function mayIncludePackagedSource(pattern: string): boolean {
  const normalized = normalizeRepoPath(pattern);
  if (!normalized.startsWith("src/") || normalized.endsWith(".test.ts")) return false;
  const leaf = normalized.slice(normalized.lastIndexOf("/") + 1);
  const extension = leaf.match(/\.([^./*]+)$/)?.[1];
  return extension === undefined || extension === "ts" || extension === "hbs";
}

export async function repositoryShipsCommittedDist(rootDirectory: string): Promise<boolean> {
  try {
    const manifest: unknown = JSON.parse(await readFile(join(rootDirectory, "package.json"), "utf8"));
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return false;
    const record = manifest as { files?: unknown; scripts?: unknown };
    if (
      !Array.isArray(record.files)
      || !record.files.some((entry) => ["dist", "dist/**", "./dist", "./dist/**"].includes(String(entry)))
    ) return false;
    if (!record.scripts || typeof record.scripts !== "object" || Array.isArray(record.scripts)) return false;
    return typeof (record.scripts as { build?: unknown }).build === "string";
  } catch {
    return false;
  }
}

export function taskHasRequiredPackagedDistCheck(task: ProjectTask): boolean {
  const checks: readonly TaskVerificationCheck[] = task.verification ?? task.verificationCommands.map((command, index) => ({
    id: `check-${index + 1}`,
    type: "automated",
    required: true,
    environment: "local",
    profile: "deterministic",
    command,
  }));
  return checks.some((check) => (
    check.id === PACKAGED_DIST_CHECK_ID
    && check.required
    && check.type === "automated"
    && check.environment === "local"
    && check.profile === "deterministic"
    && check.command === PACKAGED_DIST_CHECK_COMMAND
  ));
}

export function packagedDistTaskContractBlockers(task: ProjectTask): string[] {
  if (task.state !== "doing" && task.state !== "review") return [];
  if (!task.allowedFiles.some(mayIncludePackagedSource)) return [];

  const blockers: string[] = [];
  const forbiddenDist = task.forbiddenFiles.some(taskPathPatternMayMatchDistOutput);
  if (!task.allowedFiles.includes("dist/**") || forbiddenDist) {
    blockers.push(
      "packaged-source: Allow dist/** and remove any matching dist prohibition so generated package output can be committed.",
    );
  }
  if (!taskHasRequiredPackagedDistCheck(task)) {
    blockers.push(
      `packaged-source: Require check ${PACKAGED_DIST_CHECK_ID} with command ${PACKAGED_DIST_CHECK_COMMAND} to prove generated dist is current.`,
    );
  }
  return blockers;
}

export function packagedInputPathsChanged(paths: readonly string[]): boolean {
  return paths.some(isPackagedInputPath);
}
