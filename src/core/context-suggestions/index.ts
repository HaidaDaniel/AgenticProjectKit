import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";

const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".cache",
  "coverage",
]);

const ROOT_FILES = [
  "AGENTS.md",
  "README.md",
  "package.json",
  "tsconfig.json",
  "pnpm-lock.yaml",
];

const KEYWORD_GROUPS: Record<string, string[]> = {
  auth: ["auth", "login", "user", "session", "middleware"],
  login: ["auth", "login", "user", "session"],
  user: ["user", "auth", "profile", "account"],
  middleware: ["middleware", "route", "api", "auth"],
  api: ["api", "route", "controller", "handler"],
  route: ["route", "router", "api", "page"],
  schema: ["schema", "model", "types", "validation"],
  config: ["config", "settings", "env"],
  test: ["test", "spec"],
  docs: ["docs", "readme"],
  cli: ["cli", "command"],
  audit: ["audit", "scanner", "readiness"],
  task: ["task", "tasks", "workflow"],
  sync: ["sync", "export"],
  prompt: ["prompt", "context"],
  export: ["export", "sync"],
  status: ["status", "summary"],
  doctor: ["doctor", "diagnostic", "health"],
};

export interface ContextSuggestion {
  path: string;
  score: number;
}

export interface ContextSuggestionResult {
  description: string;
  contextFiles: string[];
  allowedFiles: string[];
}

function tokenize(text: string): string[] {
  return [...new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2),
  )];
}

function expandTokens(tokens: readonly string[]): string[] {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const related of KEYWORD_GROUPS[token] ?? []) {
      expanded.add(related);
    }
  }
  return [...expanded];
}

async function walk(rootDirectory: string, relativeDirectory: string): Promise<string[]> {
  const directory = join(rootDirectory, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        files.push(...await walk(rootDirectory, relativePath));
      }
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

async function candidateFiles(rootDirectory: string): Promise<string[]> {
  const roots = ["src", "test", "tests", "docs"];
  const rootFiles = ROOT_FILES;
  const scanned = (await Promise.all(roots.map((root) => walk(rootDirectory, root)))).flat();
  return [...new Set([...rootFiles, ...scanned])]
    .filter((file) => !file.split("/").some((part) => IGNORE_DIRS.has(part)))
    .sort();
}

function scoreFile(path: string, tokens: readonly string[]): number {
  const lower = path.toLowerCase();
  const filename = basename(lower);
  let score = 0;

  for (const token of tokens) {
    if (filename.includes(token)) {
      score += 4;
    } else if (lower.includes(token)) {
      score += 2;
    }
  }

  if (/\.(test|spec)\.[a-z]+$/.test(lower) || lower.includes("/test/") || lower.includes("/tests/")) {
    score += tokens.some((token) => token === "test" || token === "spec") ? 3 : 1;
  }

  if (lower.endsWith(".md") && tokens.includes("docs")) {
    score += 2;
  }

  return score;
}

export async function suggestContext(
  rootDirectory: string,
  description: string,
  options: { limit?: number } = {},
): Promise<ContextSuggestionResult> {
  const tokens = expandTokens(tokenize(description));
  const limit = options.limit ?? 8;
  const scored = (await candidateFiles(rootDirectory))
    .map((path) => ({ path, score: scoreFile(path, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
    .slice(0, limit);

  const contextFiles = [
    "AGENTS.md",
    ...scored.map((entry) => entry.path).filter((path) => path !== "AGENTS.md"),
  ];
  const allowedFiles = scored
    .map((entry) => entry.path)
    .filter((path) => !path.endsWith(".md") || path.startsWith("docs/"));

  return {
    description,
    contextFiles: [...new Set(contextFiles)],
    allowedFiles: [...new Set(allowedFiles)],
  };
}

export function renderContextSuggestion(result: ContextSuggestionResult): string {
  const context = result.contextFiles.length === 0 ? ["- none"] : result.contextFiles.map((file) => `- ${file}`);
  const allowed = result.allowedFiles.length === 0 ? ["- none"] : result.allowedFiles.map((file) => `- ${file}`);

  return [
    `Description: ${result.description}`,
    "",
    "Context files",
    ...context,
    "",
    "Files allowed to edit",
    ...allowed,
    "",
  ].join("\n");
}
