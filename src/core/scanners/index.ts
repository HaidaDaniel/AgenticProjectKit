import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface RepositoryScan {
  rootName: string;
  topLevelDirectories: string[];
  topLevelFiles: string[];
  detectedStack: string[];
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

  return {
    rootName: rootDirectory.split(/[\\/]/).filter(Boolean).at(-1) ?? rootDirectory,
    topLevelDirectories,
    topLevelFiles,
    detectedStack: [...detectedStack].sort(),
  };
}
