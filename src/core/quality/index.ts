import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";

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

async function hasDirectoryEntries(path: string): Promise<boolean> {
  try {
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

  const ciMarker = await hasAny(rootDirectory, [
    ".github/workflows",
    ".gitlab-ci.yml",
    ".gitlab-ci.yaml",
    ".circleci/config.yml",
    "azure-pipelines.yml",
    "bitbucket-pipelines.yml",
    "buildkite.yml",
    ".buildkite",
    ".drone.yml",
    "Jenkinsfile",
  ]);
  if (ciMarker) addMarkerEvidence(states, "ci", ciMarker, "platform-neutral CI configuration detected");
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
      lines.push(`  evidence: ${evidence.source} - ${evidence.detail}`);
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
