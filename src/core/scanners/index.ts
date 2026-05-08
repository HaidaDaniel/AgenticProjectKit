import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { CONFIG_PATH } from "../config/index.js";
import { listAgentExporters } from "../exporters/index.js";

export interface RepositoryFileSet {
  expected: string[];
  present: string[];
  missing: string[];
}

export interface RepositoryScan {
  rootName: string;
  topLevelDirectories: string[];
  topLevelFiles: string[];
  detectedStack: string[];
  kitDocs: RepositoryFileSet;
  agentExports: RepositoryFileSet;
  hasAgenticConfig: boolean;
  taskFiles: string[];
}

const IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".cache",
]);

const REQUIRED_KIT_DOCS = [
  "AGENTS.md",
  "docs/project.md",
  "docs/scope.md",
  "docs/architecture.md",
  "docs/task-system.md",
  "docs/context-system.md",
  "docs/decisions.md",
  "docs/progress.md",
] as const;

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return false;
    }

    throw error;
  }
}

async function listMarkdownFiles(rootDirectory: string, directory: string): Promise<string[]> {
  try {
    return (await readdir(join(rootDirectory, directory)))
      .filter((entry) => entry.endsWith(".md"))
      .map((entry) => `${directory}/${entry}`)
      .sort();
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}

async function scanFileSet(
  rootDirectory: string,
  expected: readonly string[],
): Promise<RepositoryFileSet> {
  const present: string[] = [];
  const missing: string[] = [];

  for (const path of expected) {
    if (await fileExists(join(rootDirectory, path))) {
      present.push(path);
    } else {
      missing.push(path);
    }
  }

  return {
    expected: [...expected],
    present,
    missing,
  };
}

async function detectPackageStack(rootDirectory: string): Promise<string[]> {
  const packagePath = join(rootDirectory, "package.json");

  if (!(await fileExists(packagePath))) {
    return [];
  }

  const packageJson = JSON.parse(await readFile(packagePath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  const stack = ["Node.js"];

  if ("typescript" in dependencies) {
    stack.push("TypeScript");
  }

  if ("react" in dependencies) {
    stack.push("React");
  }

  if ("next" in dependencies) {
    stack.push("Next.js");
  }

  if ("vite" in dependencies) {
    stack.push("Vite");
  }

  return stack;
}

export async function scanRepository(rootDirectory: string): Promise<RepositoryScan> {
  const entries = await readdir(rootDirectory, { withFileTypes: true });
  const topLevelDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !IGNORED_DIRECTORIES.has(name))
    .sort();
  const topLevelFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  const detectedStack = new Set<string>(await detectPackageStack(rootDirectory));

  if (await fileExists(join(rootDirectory, "tsconfig.json"))) {
    detectedStack.add("TypeScript");
  }

  if (await fileExists(join(rootDirectory, "pnpm-lock.yaml"))) {
    detectedStack.add("pnpm");
  }

  if (await fileExists(join(rootDirectory, "requirements.txt"))) {
    detectedStack.add("Python");
  }

  const agentExportPaths = listAgentExporters().map((exporter) => exporter.outputPath);

  return {
    rootName: rootDirectory.split(/[\\/]/).filter(Boolean).at(-1) ?? rootDirectory,
    topLevelDirectories,
    topLevelFiles,
    detectedStack: [...detectedStack].sort(),
    kitDocs: await scanFileSet(rootDirectory, REQUIRED_KIT_DOCS),
    agentExports: await scanFileSet(rootDirectory, agentExportPaths),
    hasAgenticConfig: await fileExists(join(rootDirectory, CONFIG_PATH)),
    taskFiles: await listMarkdownFiles(rootDirectory, ".tasks"),
  };
}
