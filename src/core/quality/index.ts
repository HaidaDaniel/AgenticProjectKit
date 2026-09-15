import { execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const QUALITY_CAPABILITY_IDS = [
  "typecheck",
  "lint",
  "tests",
  "build",
  "coverage",
  "hooks",
  "ci",
] as const;

export type QualityCapabilityId = (typeof QUALITY_CAPABILITY_IDS)[number];
export type QualityCapabilityStatus = "detected" | "missing" | "unknown";
export type QualityConfidence = "high" | "medium" | "low";
export type QualityPolicyDisposition =
  | "required-detected"
  | "required-missing"
  | "required-unknown"
  | "recommended-detected"
  | "recommended-missing"
  | "recommended-unknown"
  | "optional-detected"
  | "optional-missing"
  | "optional-unknown";

export interface QualityPolicy {
  required: QualityCapabilityId[];
  recommended: QualityCapabilityId[];
}

export interface QualityEvidence {
  source: string;
  detail: string;
  confidence: QualityConfidence;
}

export interface QualityCapabilityResult {
  id: QualityCapabilityId;
  status: QualityCapabilityStatus;
  evidence: QualityEvidence[];
  disposition: QualityPolicyDisposition;
  recommendation?: string;
}

export interface QualityPolicyResult {
  configured: boolean;
  required: QualityCapabilityId[];
  recommended: QualityCapabilityId[];
  status: "pass" | "fail";
  missingRequired: QualityCapabilityId[];
  unknownRequired: QualityCapabilityId[];
}

export interface QualityDetectionResult {
  schemaVersion: 1;
  repository: string;
  supported: boolean;
  capabilities: QualityCapabilityResult[];
  policy: QualityPolicyResult;
  diagnostics: string[];
}

interface PackageJson {
  scripts?: Record<string, unknown>;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  [key: string]: unknown;
}

interface EvidenceState {
  status: QualityCapabilityStatus;
  evidence: QualityEvidence[];
}

const KNOWN_REPOSITORY_MARKERS = [
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "composer.json",
  "mix.exs",
  "Gemfile",
  "Makefile",
  ".gitlab-ci.yml",
  ".gitlab-ci.yaml",
  "azure-pipelines.yml",
  "bitbucket-pipelines.yml",
  "Jenkinsfile",
  ".pre-commit-config.yaml",
  ".pre-commit-config.yml",
] as const;

const CAPABILITY_RECOMMENDATIONS: Record<QualityCapabilityId, string> = {
  typecheck: "Add an explicit typecheck or static-analysis command/configuration.",
  lint: "Add an explicit source-lint command; a typecheck-only command is not lint.",
  tests: "Add an automated test command or a recognized test configuration.",
  build: "Add an explicit build or package-validation command.",
  coverage: "Add an explicit coverage command or coverage configuration.",
  hooks: "Add an explicit local-hook configuration if local hooks are part of repository policy.",
  ci: "Add a platform-neutral clean-checkout or CI configuration if CI is required.",
};

const LINT_COMMAND = /(?:eslint|biome\s+(?:check|lint)|oxlint|stylelint|ruff\s+(?:check|format)|pylint|flake8|golangci-lint|cargo\s+clippy|rubocop|swiftlint|prettier\s+--check|deno\s+lint)/i;
const TEST_COMMAND = /(?:vitest|jest|mocha|ava|node\s+(?:--test|test)|pytest|nose|cargo\s+test|go\s+test|dotnet\s+test|mvn\s+test|gradle\s+test|mix\s+test|rspec)/i;
const BUILD_COMMAND = /(?:tsc(?:\s|$)|esbuild|rollup|vite\s+build|webpack|parcel\s+build|cargo\s+build|go\s+build|mvn\s+(?:package|verify)|gradle\s+build|mix\s+compile)/i;
const COVERAGE_COMMAND = /(?:coverage|c8|nyc|istanbul|pytest-cov|--cov(?:\b|=)|opencover|jacoco)/i;

function emptyState(supported: boolean): EvidenceState {
  return { status: supported ? "missing" : "unknown", evidence: [] };
}

function addEvidence(
  states: Map<QualityCapabilityId, EvidenceState>,
  id: QualityCapabilityId,
  evidence: QualityEvidence,
): void {
  const state = states.get(id);
  if (!state) return;
  state.status = "detected";
  if (!state.evidence.some((item) => item.source === evidence.source && item.detail === evidence.detail)) {
    state.evidence.push(evidence);
  }
}

function normalizeCommand(value: string): string {
  return value
    .trim()
    .replace(/^(?:pnpm|npm|yarn|bun)\s+(?:exec|run)\s+/i, "")
    .replace(/\s+/g, " ");
}

function isTypecheckOnlyCommand(value: string): boolean {
  const command = normalizeCommand(value);
  return /^(?:tsc|typescript)(?:\s+[^&|;]+)*\s+--noEmit(?:\s+[^&|;]+)*$/i.test(command);
}

function scriptEntries(packageJson: PackageJson | undefined): Array<[string, string]> {
  if (!packageJson?.scripts || typeof packageJson.scripts !== "object") return [];
  return Object.entries(packageJson.scripts)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .sort(([left], [right]) => left.localeCompare(right));
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function readJson(path: string): Promise<{ value?: PackageJson; invalid: boolean }> {
  try {
    return { value: JSON.parse(await readFile(path, "utf8")) as PackageJson, invalid: false };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { invalid: false };
    }
    return { invalid: true };
  }
}

async function readText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function hasDirectoryEntries(path: string): Promise<boolean> {
  try {
    if (!(await stat(path)).isDirectory()) return false;
    return (await readdir(path)).length > 0;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function hasAny(rootDirectory: string, paths: readonly string[]): Promise<string | undefined> {
  for (const path of paths) {
    if (await exists(join(rootDirectory, path))) return path;
  }
  return undefined;
}

const GO_TEST_DISCOVERY_SKIP = new Set([
  ".git",
  "vendor",
  "node_modules",
  "dist",
  "build",
  "out",
  "bin",
  "coverage",
  "tmp",
]);

const MAX_GO_TEST_DISCOVERY_DIRS = 512;

function isSkippedGoTestPath(path: string): boolean {
  return path.split("/").some((segment) => GO_TEST_DISCOVERY_SKIP.has(segment));
}

/**
 * Canonical Git-aware repository inventory for Go tests: tracked plus untracked
 * non-ignored files (`--cached --others --exclude-standard`), filtered to
 * `*_test.go` outside vendored/generated/heavy directories. Returns `undefined`
 * when Git is unavailable so the caller can use the bounded filesystem fallback.
 * A successful Git result (even empty) is authoritative for a Git repository.
 */
async function gitInventoryGoTestFiles(rootDirectory: string): Promise<string[] | undefined> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard"],
      { cwd: rootDirectory, windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
    );
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.endsWith("_test.go") && !isSkippedGoTestPath(line))
      .sort();
  } catch {
    return undefined;
  }
}

/**
 * Bounded package-local Go test discovery. Canonical Git inventory is
 * authoritative when Git is available, so `.gitignore` semantics are honored
 * and a Git repository never falls through to the ignore-unaware walk. The
 * bounded walk (at most two directory levels, 512-directory cap, skip-aware)
 * is used only for non-Git directories.
 */
async function findGoTestFiles(rootDirectory: string): Promise<string[]> {
  const gitFiles = await gitInventoryGoTestFiles(rootDirectory);
  if (gitFiles !== undefined) return gitFiles.slice(0, 16);

  const results: string[] = [];
  let visited = 0;
  const walk = async (relative: string, depth: number): Promise<void> => {
    visited += 1;
    if (visited > MAX_GO_TEST_DISCOVERY_DIRS) return;
    let entries: string[];
    try {
      entries = await readdir(join(rootDirectory, relative));
    } catch {
      return;
    }
    for (const entry of entries.sort()) {
      const child = relative ? `${relative}/${entry}` : entry;
      if (entry.endsWith("_test.go")) {
        results.push(child);
      }
      if (depth + 1 <= 2 && !GO_TEST_DISCOVERY_SKIP.has(entry) && !entry.includes(".go")) {
        try {
          if ((await stat(join(rootDirectory, child))).isDirectory()) {
            await walk(child, depth + 1);
          }
        } catch {
          // skip unreadable entries
        }
      }
    }
  };
  await walk("", 0);
  return results.slice(0, 16);
}

async function matchingFiles(rootDirectory: string, paths: readonly string[]): Promise<string[]> {
  const matches: string[] = [];
  for (const path of paths) {
    try {
      if ((await stat(join(rootDirectory, path))).isFile()) matches.push(path);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") continue;
      throw error;
    }
  }
  return matches;
}

async function matchingNonEmptyDirectories(rootDirectory: string, paths: readonly string[]): Promise<string[]> {
  const matches: string[] = [];
  for (const path of paths) {
    if (await hasDirectoryEntries(join(rootDirectory, path))) matches.push(path);
  }
  return matches;
}

function createStates(supported: boolean): Map<QualityCapabilityId, EvidenceState> {
  return new Map(QUALITY_CAPABILITY_IDS.map((id) => [id, emptyState(supported)]));
}

function addScriptEvidence(
  states: Map<QualityCapabilityId, EvidenceState>,
  name: string,
  command: string,
): void {
  const source = `package.json#scripts.${name}`;
  const detail = `${name}: ${command}`;
  const normalized = normalizeCommand(command);
  const typecheckOnly = isTypecheckOnlyCommand(command);

  if (typecheckOnly || /(?:typecheck|type-check|types|check:types)/i.test(name)) {
    addEvidence(states, "typecheck", { source, detail, confidence: "high" });
  }
  if (!typecheckOnly && (/(?:^|:)lint(?:$|:)/i.test(name) || LINT_COMMAND.test(normalized))) {
    addEvidence(states, "lint", { source, detail, confidence: "high" });
  }
  if (/(?:^|:)(?:test|tests)(?:$|:)/i.test(name) || TEST_COMMAND.test(normalized)) {
    addEvidence(states, "tests", { source, detail, confidence: "high" });
  }
  if (/(?:^|:)(?:build|bundle|compile|package|pack)(?:$|:)/i.test(name) || (BUILD_COMMAND.test(normalized) && !/--noEmit\b/i.test(normalized))) {
    addEvidence(states, "build", { source, detail, confidence: "high" });
  }
  if (COVERAGE_COMMAND.test(`${name} ${normalized}`)) {
    addEvidence(states, "coverage", { source, detail, confidence: "high" });
  }
}

function addMarkerEvidence(
  states: Map<QualityCapabilityId, EvidenceState>,
  id: QualityCapabilityId,
  source: string,
  detail: string,
  confidence: QualityConfidence = "medium",
): void {
  addEvidence(states, id, { source, detail, confidence });
}

async function detectMarkers(rootDirectory: string, states: Map<QualityCapabilityId, EvidenceState>): Promise<void> {
  const typecheckMarker = await hasAny(rootDirectory, ["tsconfig.json", "jsconfig.json"]);
  if (typecheckMarker) addMarkerEvidence(states, "typecheck", typecheckMarker, "compiler configuration detected");

  const lintMarker = await hasAny(rootDirectory, [
    ".eslintrc",
    ".eslintrc.json",
    ".eslintrc.js",
    ".eslintrc.cjs",
    "eslint.config.js",
    "eslint.config.mjs",
    "biome.json",
    "biome.jsonc",
    "ruff.toml",
    ".ruff.toml",
    ".golangci.yml",
  ]);
  if (lintMarker) addMarkerEvidence(states, "lint", lintMarker, "lint configuration detected");

  const testMarker = await hasAny(rootDirectory, [
    "jest.config.js",
    "jest.config.ts",
    "vitest.config.ts",
    "vitest.config.js",
    "pytest.ini",
    "tox.ini",
    "phpunit.xml",
  ]);
  if (testMarker) addMarkerEvidence(states, "tests", testMarker, "test configuration detected");

  const buildMarker = await hasAny(rootDirectory, [
    "vite.config.ts",
    "vite.config.js",
    "webpack.config.js",
    "rollup.config.js",
    "Makefile",
    "Cargo.toml",
    "go.mod",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
  ]);
  if (buildMarker) addMarkerEvidence(states, "build", buildMarker, "build or package configuration detected");

  // Bounded native Go test evidence: for Git repositories, canonical inventory
  // (`git ls-files --cached --others --exclude-standard`) filtered to `*_test.go` outside
  // vendored/generated trees is strong test evidence and honors `.gitignore`. The shallow
  // (depth <= 2, 512-dir) bounded walk handles non-Git directories only.
  if (await exists(join(rootDirectory, "go.mod"))) {
    const goTestFiles = await findGoTestFiles(rootDirectory);
    if (goTestFiles.length > 0) {
      addMarkerEvidence(
        states,
        "tests",
        `${goTestFiles.length} *_test.go file(s)`,
        `Go package-local test files detected: ${goTestFiles.slice(0, 3).join(", ")}`,
        "high",
      );
    }
  }

  const pyproject = await readText(join(rootDirectory, "pyproject.toml"));
  if (pyproject !== undefined) {
    const markerRules: Array<[QualityCapabilityId, RegExp, string]> = [
      ["typecheck", /\[tool\.(?:mypy|pyright)\]/i, "Python typecheck configuration detected"],
      ["lint", /\[tool\.(?:ruff|pylint)\]/i, "Python lint configuration detected"],
      ["tests", /\[tool\.(?:pytest(?:\.ini_options)?|tox)\]/i, "Python test configuration detected"],
      ["coverage", /\[tool\.(?:coverage|pytest-cov)(?:\.[^\]]+)?\]/i, "Python coverage configuration detected"],
    ];
    for (const [id, pattern, detail] of markerRules) {
      if (pattern.test(pyproject)) addMarkerEvidence(states, id, "pyproject.toml", detail, "high");
    }
  }

  const coverageMarker = await hasAny(rootDirectory, [
    ".nycrc",
    ".nycrc.json",
    "nyc.config.js",
    "c8.config.js",
    "coverage.config.js",
    "codecov.yml",
    "codecov.yaml",
    "sonar-project.properties",
  ]);
  if (coverageMarker) addMarkerEvidence(states, "coverage", coverageMarker, "coverage configuration detected");

  const hookMarker = await hasAny(rootDirectory, [
    ".husky",
    ".pre-commit-config.yaml",
    ".pre-commit-config.yml",
    "lefthook.yml",
    "lefthook.yaml",
    ".lefthook.yml",
    ".lefthook.yaml",
  ]);
  if (hookMarker && (await exists(join(rootDirectory, hookMarker))) &&
      (hookMarker === ".husky" ? await hasDirectoryEntries(join(rootDirectory, hookMarker)) : true)) {
    addMarkerEvidence(states, "hooks", hookMarker, "local-hook configuration detected");
  }

  const ciFileMarkers = await matchingFiles(rootDirectory, [
    ".gitlab-ci.yml",
    ".gitlab-ci.yaml",
    ".circleci/config.yml",
    "azure-pipelines.yml",
    "bitbucket-pipelines.yml",
    "buildkite.yml",
    ".drone.yml",
    "Jenkinsfile",
  ]);
  const ciDirectoryMarkers = await matchingNonEmptyDirectories(rootDirectory, [".github/workflows", ".buildkite"]);
  for (const marker of [...ciDirectoryMarkers, ...ciFileMarkers]) {
    addMarkerEvidence(states, "ci", marker, "platform-neutral CI configuration detected");
  }
}

function resolvePolicy(policy: QualityPolicy | undefined): QualityPolicyResult {
  const required = [...new Set(policy?.required ?? [])].sort();
  const requiredSet = new Set(required);
  const recommended = [...new Set((policy?.recommended ?? []).filter((id) => !requiredSet.has(id)))].sort();
  return {
    configured: policy !== undefined,
    required,
    recommended,
    status: "pass",
    missingRequired: [],
    unknownRequired: [],
  };
}

function dispositionFor(
  status: QualityCapabilityStatus,
  id: QualityCapabilityId,
  policy: QualityPolicyResult,
): QualityPolicyDisposition {
  const required = policy.required.includes(id);
  const recommended = policy.recommended.includes(id);
  const prefix = required ? "required" : recommended ? "recommended" : "optional";
  return `${prefix}-${status}` as QualityPolicyDisposition;
}

export function renderQualityDetection(result: QualityDetectionResult, json = false): string {
  if (json) return `${JSON.stringify(result, null, 2)}\n`;
  const lines = [
    "Quality detection (read-only):",
    `Repository: ${result.repository}`,
    `Policy: ${result.policy.configured ? "explicit" : "default"} (${result.policy.status})`,
  ];
  for (const capability of result.capabilities) {
    lines.push(`- ${capability.id}: ${capability.status} (${capability.disposition})`);
    for (const evidence of capability.evidence) {
      lines.push(`  evidence: ${evidence.source} - ${evidence.detail} [${evidence.confidence}]`);
    }
    if (capability.recommendation) lines.push(`  recommendation: ${capability.recommendation}`);
  }
  if (result.diagnostics.length > 0) {
    lines.push("Diagnostics:");
    for (const diagnostic of result.diagnostics) lines.push(`- ${diagnostic}`);
  }
  lines.push(`Result: ${result.policy.status}`);
  lines.push("");
  return lines.join("\n");
}

export async function detectQualityCapabilities(
  rootDirectory: string,
  policy?: QualityPolicy,
): Promise<QualityDetectionResult> {
  const packagePath = join(rootDirectory, "package.json");
  const packagePresent = await exists(packagePath);
  const packageResult = await readJson(packagePath);
  const topLevelMarkers = await Promise.all(KNOWN_REPOSITORY_MARKERS.map((marker) => exists(join(rootDirectory, marker))));
  const supported = packageResult.value !== undefined || topLevelMarkers.some(Boolean);
  const states = createStates(supported);
  const diagnostics: string[] = [];

  if (packageResult.invalid) diagnostics.push("package.json could not be parsed; package-script evidence is unknown.");
  if (packageResult.value) {
    for (const [name, command] of scriptEntries(packageResult.value)) addScriptEvidence(states, name, command);
    if (packageResult.value.devDependencies?.typescript || packageResult.value.dependencies?.typescript) {
      addMarkerEvidence(states, "typecheck", "package.json", "TypeScript dependency detected", "high");
    }
  }
  if (packagePresent && packageResult.value === undefined) diagnostics.push("The repository has a package manifest but no reliable package capability inventory.");

  await detectMarkers(rootDirectory, states);

  const policyResult = resolvePolicy(policy);
  const capabilities = QUALITY_CAPABILITY_IDS.map((id) => {
    const state = states.get(id) as EvidenceState;
    const disposition = dispositionFor(state.status, id, policyResult);
    const required = policyResult.required.includes(id);
    if (required && state.status === "missing") policyResult.missingRequired.push(id);
    if (required && state.status === "unknown") policyResult.unknownRequired.push(id);
    return {
      id,
      status: state.status,
      evidence: [...state.evidence].sort((left, right) => left.source.localeCompare(right.source) || left.detail.localeCompare(right.detail)),
      disposition,
      ...((state.status !== "detected") ? { recommendation: CAPABILITY_RECOMMENDATIONS[id] } : {}),
    } satisfies QualityCapabilityResult;
  });
  policyResult.missingRequired.sort();
  policyResult.unknownRequired.sort();
  policyResult.status = policyResult.missingRequired.length > 0 || policyResult.unknownRequired.length > 0 ? "fail" : "pass";
  if (policyResult.missingRequired.length > 0) {
    diagnostics.push(`Required capabilities missing: ${policyResult.missingRequired.join(", ")}.`);
  }
  if (policyResult.unknownRequired.length > 0) {
    diagnostics.push(`Required capabilities unknown: ${policyResult.unknownRequired.join(", ")}; provide explicit evidence or a supported repository marker.`);
  }
  if (!supported) diagnostics.push("Repository shape is unsupported or empty; capabilities remain unknown and no defaults are required.");

  return {
    schemaVersion: 1,
    repository: basename(rootDirectory),
    supported,
    capabilities,
    policy: policyResult,
    diagnostics,
  };
}
