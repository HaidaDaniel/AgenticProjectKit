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
  readiness: RepositoryReadinessScan;
  kitDocs: RepositoryFileSet;
  agentExports: RepositoryFileSet;
  hasAgenticConfig: boolean;
  taskFiles: string[];
}

export interface RepositoryReadinessScan {
  packageManager: string | undefined;
  packageScripts: string[];
  lockfiles: string[];
  hasCi: boolean;
  hasEnvExample: boolean;
  hasDockerfile: boolean;
  hasDockerCompose: boolean;
  hasReadme: boolean;
  hasLicense: boolean;
  testDirectories: string[];
  generatedDirectories: string[];
  monorepo: boolean;
  tsStrict: boolean | undefined;
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

async function readJsonFile(path: string): Promise<Record<string, unknown> | undefined> {
  if (!(await fileExists(path))) {
    return undefined;
  }

  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}

async function scanReadiness(
  rootDirectory: string,
  topLevelDirectories: readonly string[],
  topLevelFiles: readonly string[],
): Promise<RepositoryReadinessScan> {
  const packageJson = await readJsonFile(join(rootDirectory, "package.json"));
  const scripts = packageJson?.scripts && typeof packageJson.scripts === "object"
    ? Object.keys(packageJson.scripts as Record<string, unknown>).sort()
    : [];
  const lockfiles = [
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
    "bun.lockb",
  ].filter((file) => topLevelFiles.includes(file));
  const packageManager = topLevelFiles.includes("pnpm-lock.yaml") ? "pnpm"
    : topLevelFiles.includes("package-lock.json") ? "npm"
    : topLevelFiles.includes("yarn.lock") ? "yarn"
    : topLevelFiles.includes("bun.lockb") ? "bun"
    : undefined;
  const tsconfig = await readJsonFile(join(rootDirectory, "tsconfig.json"));
  const compilerOptions = tsconfig?.compilerOptions && typeof tsconfig.compilerOptions === "object"
    ? tsconfig.compilerOptions as Record<string, unknown>
    : undefined;

  return {
    packageManager,
    packageScripts: scripts,
    lockfiles,
    hasCi: await fileExists(join(rootDirectory, ".github", "workflows")),
    hasEnvExample: topLevelFiles.includes(".env.example"),
    hasDockerfile: topLevelFiles.includes("Dockerfile"),
    hasDockerCompose: topLevelFiles.includes("docker-compose.yml") || topLevelFiles.includes("docker-compose.yaml"),
    hasReadme: topLevelFiles.some((file) => /^readme\.md$/i.test(file)),
    hasLicense: topLevelFiles.some((file) => /^licen[sc]e(\.md|\.txt)?$/i.test(file)),
    testDirectories: topLevelDirectories.filter((directory) => ["test", "tests", "__tests__"].includes(directory)),
    generatedDirectories: topLevelDirectories.filter((directory) => ["dist", "build", ".next", "coverage"].includes(directory)),
    monorepo: topLevelFiles.includes("pnpm-workspace.yaml") || Boolean(packageJson?.workspaces),
    tsStrict: compilerOptions ? compilerOptions.strict === true : undefined,
  };
}

export async function scanRepository(rootDirectory: string): Promise<RepositoryScan> {
  const entries = await readdir(rootDirectory, { withFileTypes: true });
  const allTopLevelDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const topLevelDirectories = allTopLevelDirectories
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
    readiness: await scanReadiness(rootDirectory, allTopLevelDirectories, topLevelFiles),
    kitDocs: await scanFileSet(rootDirectory, REQUIRED_KIT_DOCS),
    agentExports: await scanFileSet(rootDirectory, agentExportPaths),
    hasAgenticConfig: await fileExists(join(rootDirectory, CONFIG_PATH)),
    taskFiles: await listMarkdownFiles(rootDirectory, ".tasks"),
  };
}
