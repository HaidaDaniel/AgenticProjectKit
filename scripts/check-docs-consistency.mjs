import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const LINK_CHECK_FILES = [
  "README.md",
  "CHANGELOG.md",
  "docs/index.md",
  "docs/roadmap.md",
  "docs/progress.md",
  "docs/scope.md",
  "docs/cli-commands.md",
  "docs/releases/index.md",
  "docs/product/maturity-and-compatibility.md",
];

const TASK_STATES = new Set(["todo", "doing", "review", "done", "blocked", "canceled", "archived"]);
const CLI_REFERENCE_START = "<!-- BEGIN GENERATED CLI COMMAND REFERENCE -->";
const CLI_REFERENCE_END = "<!-- END GENERATED CLI COMMAND REFERENCE -->";

function report(issues, file, line, message) {
  issues.push(`${file}:${line}: ${message}`);
}

function lineNumber(text, offset) {
  return text.slice(0, Math.max(0, offset)).split(/\r?\n/).length;
}

async function readText(root, file, issues) {
  try {
    return await readFile(resolve(root, file), "utf8");
  } catch {
    report(issues, file, 1, "required documentation input is missing or unreadable");
    return "";
  }
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

const NUMERIC_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function numericVersion(value, file, issues, description) {
  const match = typeof value === "string" ? value.match(NUMERIC_SEMVER) : null;
  if (!match) {
    report(issues, file, 1, `${description} must be a numeric major.minor.patch version without leading zeroes`);
    return null;
  }
  return { text: value, parts: match.slice(1).map(BigInt) };
}

function packageVersion(value, file, issues) {
  return numericVersion(value?.version, file, issues, "package.json version");
}

function compareVersions(left, right) {
  for (let index = 0; index < left.parts.length; index += 1) {
    if (left.parts[index] !== right.parts[index]) return left.parts[index] < right.parts[index] ? -1 : 1;
  }
  return 0;
}

function validatedReleaseVersion(markdown, issues) {
  const matches = [...markdown.matchAll(/APK_VALIDATED_RELEASE/g)];
  if (matches.length !== 1) {
    const line = matches.length > 0 ? lineNumber(markdown, matches[0].index) : 1;
    const reason = matches.length === 0 ? "missing" : `found ${matches.length}`;
    report(issues, "docs/releases/index.md", line, `validated-release sentinel must appear exactly once; ${reason}`);
    return "";
  }

  const lineStart = markdown.lastIndexOf("\n", matches[0].index - 1) + 1;
  const lineEnd = markdown.indexOf("\n", matches[0].index);
  const line = markdown.slice(lineStart, lineEnd === -1 ? markdown.length : lineEnd).trim();
  const marker = line.match(/^<!-- APK_VALIDATED_RELEASE: (v.+) -->$/);
  if (!marker) {
    report(issues, "docs/releases/index.md", lineNumber(markdown, matches[0].index), "validated-release sentinel is malformed; use `<!-- APK_VALIDATED_RELEASE: vX.Y.Z -->`");
    return "";
  }

  const rawVersion = marker[1].slice(1);
  return numericVersion(rawVersion, "docs/releases/index.md", issues, "validated-release sentinel version");
}

function checkVersionClaim({ file, text, pattern, expected, issues, description, expectedLabel = "validated release" }) {
  const globalPattern = new RegExp(pattern.source, `${pattern.flags}g`);
  const matches = [...text.matchAll(globalPattern)];
  if (matches.length === 0) {
    report(issues, file, 1, `could not find the structured ${description} value`);
    return;
  }
  if (matches.length > 1) {
    report(issues, file, lineNumber(text, matches[1].index), `duplicate structured ${description} values`);
  }

  for (const match of matches) {
    const line = lineNumber(text, match.index);
    const claimedVersion = match[1];
    const linkedVersion = match[2];
    if (claimedVersion !== expected || (linkedVersion && linkedVersion !== expected)) {
      report(issues, file, line, `${description} must match ${expectedLabel} v${expected}`);
    }
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function readReleaseNote(root, version, label, issues) {
  const path = `docs/releases/v${version}.md`;
  if (!(await exists(resolve(root, path)))) {
    report(issues, "docs/releases/index.md", 1, `${label} release note does not exist: ${path}`);
    return "";
  }

  const text = await readText(root, path, issues);
  if (!new RegExp(`^# Agentic Project Kit v${escapeRegExp(version)}\\s*$`, "m").test(text)) {
    report(issues, path, 1, `${label} release note heading must name v${version}`);
  }
  return text;
}

function checkPrematureValidatedClaim(note, candidateVersion, validatedVersion, issues) {
  const pattern = /latest validated tagged release\s*(?:is|:|=)\s*`?v?(\d+\.\d+\.\d+)`?/gi;
  for (const match of note.matchAll(pattern)) {
    if (match[1] !== validatedVersion) {
      report(issues, `docs/releases/v${candidateVersion}.md`, lineNumber(note, match.index), `candidate note claims latest validated tagged release v${match[1]}; canonical validated release is v${validatedVersion}`);
    }
  }

  const candidate = `v${escapeRegExp(candidateVersion)}`;
  const publishedStatus = String.raw`(?:has\s+(?:(?:(?:already|now|just)\s+)?been\s+)?|is\s+|was\s+)(?:(?:already|currently|now)\s+)?(?:published|released|available|shipped|launched|live)`;
  const publicationClaims = [
    new RegExp(String.raw`\b${candidate}\b(?:\s+release)?\s+${publishedStatus}\b`, "gi"),
    new RegExp(String.raw`\brelease\b[^\r\n]{0,40}\b${candidate}\b[^\r\n]{0,40}\b${publishedStatus}\b`, "gi"),
  ];
  const reportedOffsets = new Set();
  for (const publicationClaim of publicationClaims) {
    for (const match of note.matchAll(publicationClaim)) {
      if (reportedOffsets.has(match.index)) continue;
      reportedOffsets.add(match.index);
      report(issues, `docs/releases/v${candidateVersion}.md`, lineNumber(note, match.index), `candidate note claims release v${candidateVersion} is already published or available; qualify the statement until validation (canonical validated release is v${validatedVersion})`);
    }
  }
}

function fencedCodeLines(markdown) {
  const blocks = [];
  const lines = markdown.split(/\r?\n/);
  let fence = null;
  let startLine = 0;
  let current = [];

  for (let index = 0; index < lines.length; index += 1) {
    const opening = lines[index].match(/^\s{0,3}(`{3,}|~{3,})/);
    if (!fence && opening) {
      fence = { marker: opening[1][0], length: opening[1].length };
      startLine = index + 2;
      current = [];
      continue;
    }

    if (fence) {
      const closing = lines[index].match(/^\s{0,3}(`{3,}|~{3,})\s*$/);
      if (closing && closing[1][0] === fence.marker && closing[1].length >= fence.length) {
        blocks.push({ lines: current, startLine });
        fence = null;
        continue;
      }
      current.push(lines[index]);
    }
  }

  return blocks;
}

function contextExamples(markdown) {
  const examples = [];
  const expression = /--context(?:\s+|=)(?:"([^"]*)"|'([^']*)'|([^\s\\]+))/g;
  for (const block of fencedCodeLines(markdown)) {
    const source = block.lines.join("\n");
    for (const match of source.matchAll(expression)) {
      const value = match[1] ?? match[2] ?? match[3] ?? "";
      if (!value || value.startsWith("<")) continue;
      const line = block.startLine + lineNumber(source, match.index) - 1;
      for (const path of value.split(",").map((item) => item.trim()).filter(Boolean)) {
        examples.push({ path, line });
      }
    }
  }
  return examples;
}

function headingSlugs(markdown) {
  const slugs = new Set();
  const counts = new Map();
  const headingPattern = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/gm;

  for (const match of markdown.matchAll(headingPattern)) {
    const title = match[1]
      .replace(/!?(\[([^\]]*)\])\([^)]*\)/g, "$2")
      .replace(/<[^>]*>/g, "")
      .replace(/`/g, "")
      .trim()
      .toLowerCase();
    const base = title.replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    slugs.add(count === 0 ? base : `${base}-${count}`);
  }

  return slugs;
}

function markdownLinksOutsideCode(markdown) {
  const links = [];
  let inFence = false;
  const lines = markdown.split(/\r?\n/);
  const linkPattern = /(?<!!)\[[^\]]+\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+[^)]*)?\)/g;

  for (let index = 0; index < lines.length; index += 1) {
    if (/^\s{0,3}(`{3,}|~{3,})/.test(lines[index])) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    for (const match of lines[index].matchAll(linkPattern)) {
      const target = (match[1] ?? "").replace(/^<|>$/g, "");
      links.push({ target, line: index + 1 });
    }
  }

  return links;
}

function displayPath(root, path) {
  return relative(root, path).split(sep).join("/") || ".";
}

async function checkMarkdownLinks(root, file, markdown, securityExists, issues) {
  const sourcePath = resolve(root, file);
  for (const { target, line } of markdownLinksOutsideCode(markdown)) {
    if (!target || target.startsWith("//") || /^[a-z][a-z\d+.-]*:/i.test(target)) continue;

    const hashAt = target.indexOf("#");
    const rawPath = hashAt === -1 ? target : target.slice(0, hashAt);
    const rawFragment = hashAt === -1 ? "" : target.slice(hashAt + 1);
    let pathPart;
    let fragment;
    try {
      pathPart = decodeURIComponent(rawPath);
      fragment = decodeURIComponent(rawFragment);
    } catch {
      report(issues, file, line, `link target has invalid percent encoding: ${target}`);
      continue;
    }

    const targetPath = resolve(dirname(sourcePath), pathPart || file.split("/").at(-1));
    const targetDisplay = displayPath(root, targetPath);
    const pathFromRoot = relative(root, targetPath);
    if (isAbsolute(pathFromRoot) || pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`)) {
      report(issues, file, line, `link escapes the repository: ${target}`);
      continue;
    }

    if (targetDisplay === "SECURITY.md" && !securityExists) continue;
    if (!(await exists(targetPath))) {
      report(issues, file, line, `relative link target does not exist: ${target}`);
      continue;
    }

    if (!fragment || extname(targetPath).toLowerCase() !== ".md") continue;

    let targetMarkdown;
    try {
      targetMarkdown = await readFile(targetPath, "utf8");
    } catch {
      report(issues, file, line, `cannot read Markdown link target: ${target}`);
      continue;
    }

    if (!headingSlugs(targetMarkdown).has(fragment)) {
      report(issues, file, line, `Markdown anchor does not exist in ${targetDisplay}: #${fragment}`);
    }
  }
}

async function collectTaskStates(root, issues) {
  const states = new Map();
  const taskRoot = resolve(root, ".tasks");

  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      report(issues, ".tasks", 1, "task directory is missing or unreadable");
      return;
    }

    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
        continue;
      }
      if (!entry.isFile() || !/^\d{4}-.+\.md$/.test(entry.name)) continue;

      const match = entry.name.match(/^(\d{4})-/);
      const taskId = match?.[1];
      if (!taskId) continue;
      if (states.has(taskId)) {
        report(issues, displayPath(root, path), 1, `duplicate task ID ${taskId} in task files`);
        continue;
      }

      let contents;
      try {
        contents = await readFile(path, "utf8");
      } catch {
        report(issues, displayPath(root, path), 1, "task file is unreadable");
        continue;
      }
      const state = contents.match(/^State:\s*(\S+)\s*$/m)?.[1];
      if (!state) {
        report(issues, displayPath(root, path), 1, "task State metadata is missing");
        continue;
      }
      if (!TASK_STATES.has(state)) {
        report(issues, displayPath(root, path), 1, `task has unsupported State metadata '${state}'`);
        continue;
      }
      states.set(taskId, { state, path: displayPath(root, path) });
    }
  }

  await visit(taskRoot);
  return states;
}

function checkRoadmapTaskStates(root, markdown, states, issues) {
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === "### Task state rows");
  if (headingIndex === -1) {
    report(issues, "docs/roadmap.md", 1, "missing the structured '### Task state rows' section");
    return;
  }

  let tableHeader = false;
  let rowCount = 0;
  const seenIds = new Set();
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^#{1,6}\s/.test(line)) break;
    if (!line.trim().startsWith("|")) continue;

    const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
    if (!tableHeader) {
      if (cells.join("|") !== "Workstream|Task|State|Contract") {
        report(issues, "docs/roadmap.md", index + 1, "task state table must have Workstream, Task, State, and Contract columns");
      }
      tableHeader = true;
      continue;
    }
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    rowCount += 1;

    if (cells.length !== 4 || !/^\d{4}$/.test(cells[1] ?? "")) {
      report(issues, "docs/roadmap.md", index + 1, "task state row must identify one four-digit task ID and one contract link");
      continue;
    }

    const taskId = cells[1];
    const declaredState = cells[2];
    if (seenIds.has(taskId)) {
      report(issues, "docs/roadmap.md", index + 1, `task ${taskId} appears more than once in the state table`);
      continue;
    }
    seenIds.add(taskId);

    if (!TASK_STATES.has(declaredState)) {
      const task = states.get(taskId);
      if (declaredState === "planned" && task?.state === "done") {
        report(issues, "docs/roadmap.md", index + 1, `completed task ${taskId} is labeled 'planned'; use 'done'`);
      } else {
        report(issues, "docs/roadmap.md", index + 1, `task ${taskId} has unsupported roadmap state '${declaredState}'`);
      }
      continue;
    }

    const contractTarget = cells[3].match(/\[[^\]]+\]\(([^)]+)\)/)?.[1];
    const contractPath = contractTarget ? resolve(dirname(resolve(root, "docs/roadmap.md")), contractTarget) : null;
    if (!contractPath || !/^\d{4}-.+\.md$/.test(contractPath.split(sep).at(-1) ?? "") || !contractPath.split(sep).at(-1).startsWith(`${taskId}-`)) {
      report(issues, "docs/roadmap.md", index + 1, `task ${taskId} must link its matching task contract`);
      continue;
    }

    const task = states.get(taskId);
    if (!task) {
      report(issues, "docs/roadmap.md", index + 1, `task ${taskId} is listed but no matching task file was discovered`);
      continue;
    }
    if (task.state !== declaredState) {
      if (task.state === "done" && (declaredState === "todo" || declaredState === "doing")) {
        report(issues, "docs/roadmap.md", index + 1, `completed task ${taskId} is labeled '${declaredState}'; use 'done'`);
      } else {
        report(issues, "docs/roadmap.md", index + 1, `task ${taskId} is labeled '${declaredState}' but its contract says '${task.state}'`);
      }
    }
  }

  if (!tableHeader) report(issues, "docs/roadmap.md", headingIndex + 1, "task state table is missing its header");
  if (rowCount === 0) report(issues, "docs/roadmap.md", headingIndex + 1, "task state table must list at least one task");
}

function checkCliReference(markdown, expectedReference, issues) {
  const start = markdown.indexOf(CLI_REFERENCE_START);
  const end = markdown.indexOf(CLI_REFERENCE_END);
  if (start === -1 || end === -1 || end < start || markdown.indexOf(CLI_REFERENCE_START, start + 1) !== -1 || markdown.indexOf(CLI_REFERENCE_END, end + 1) !== -1) {
    report(issues, "docs/cli-commands.md", 1, "CLI reference markers are missing, duplicated, or out of order");
    return;
  }

  const actual = markdown.slice(start, end + CLI_REFERENCE_END.length);
  if (actual !== expectedReference) {
    report(issues, "docs/cli-commands.md", lineNumber(markdown, start), "CLI reference is stale; regenerate it from src/cli/command-registry.ts");
  }
}

export async function checkDocumentationConsistency(root, expectedCliReference) {
  const issues = [];
  const packagePath = resolve(root, "package.json");
  let packageData;
  try {
    packageData = JSON.parse(await readFile(packagePath, "utf8"));
  } catch {
    report(issues, "package.json", 1, "package metadata is missing or invalid JSON");
    return issues;
  }

  const packageRelease = packageVersion(packageData, "package.json", issues);
  const version = packageRelease?.text ?? "";
  const qualityScript = packageData.scripts?.quality;
  if (typeof qualityScript !== "string" || !qualityScript.includes("node scripts/check-docs-consistency.mjs")) {
    report(issues, "package.json", 1, "the quality script must run node scripts/check-docs-consistency.mjs");
  }
  const qualityWorkflow = await readText(root, ".github/workflows/quality.yml", issues);
  if (!/^\s+run:\s+pnpm quality\s*$/m.test(qualityWorkflow)) {
    report(issues, ".github/workflows/quality.yml", 1, "the hosted quality workflow must run pnpm quality");
  }

  const documents = new Map();
  for (const file of new Set([
    ...LINK_CHECK_FILES,
    "docs/releases/index.md",
    "docs/product/maturity-and-compatibility.md",
    "docs/cli-commands.md",
  ])) {
    documents.set(file, await readText(root, file, issues));
  }

  const readme = documents.get("README.md") ?? "";
  const changelog = documents.get("CHANGELOG.md") ?? "";
  const index = documents.get("docs/index.md") ?? "";
  const roadmap = documents.get("docs/roadmap.md") ?? "";
  const progress = documents.get("docs/progress.md") ?? "";
  const scope = documents.get("docs/scope.md") ?? "";
  const releaseIndex = documents.get("docs/releases/index.md") ?? "";
  const maturity = documents.get("docs/product/maturity-and-compatibility.md") ?? "";
  const cliReference = documents.get("docs/cli-commands.md") ?? "";
  const validatedRelease = validatedReleaseVersion(releaseIndex, issues);
  const validatedVersion = validatedRelease?.text ?? "";

  if (packageRelease && validatedRelease && compareVersions(packageRelease, validatedRelease) < 0) {
    report(issues, "package.json", 1, `package version ${version} is below the latest validated release v${validatedVersion}`);
  }

  const versionClaims = [
    {
      file: "README.md",
      text: readme,
      pattern: /The current validated installable release is \[v(\d+\.\d+\.\d+)\]\(docs\/releases\/v(\d+\.\d+\.\d+)\.md\)/,
      description: "validated release and note link",
    },
    {
      file: "CHANGELOG.md",
      text: changelog,
      pattern: /\[v(\d+\.\d+\.\d+)\]\(docs\/releases\/v(\d+\.\d+\.\d+)\.md\) is the latest validated installable release/,
      description: "changelog latest validated release and note link",
    },
    {
      file: "docs/product/maturity-and-compatibility.md",
      text: maturity,
      pattern: /latest validated, installable release at this policy snapshot is `v(\d+\.\d+\.\d+)`/i,
      description: "latest validated release",
    },
    {
      file: "docs/product/maturity-and-compatibility.md",
      text: maturity,
      pattern: /\| Package release \| `v(\d+\.\d+\.\d+)` is the latest validated Git-tag release/,
      description: "maturity-policy validated Git-tag release",
    },
    {
      file: "docs/roadmap.md",
      text: roadmap,
      pattern: /\[v(\d+\.\d+\.\d+)\]\(releases\/v(\d+\.\d+\.\d+)\.md\) is the latest validated installable release/,
      description: "latest roadmap release and note link",
    },
    {
      file: "docs/progress.md",
      text: progress,
      pattern: /The latest validated, installable release is \[v(\d+\.\d+\.\d+)\]\(releases\/v(\d+\.\d+\.\d+)\.md\)/,
      description: "progress latest validated release and note link",
    },
    {
      file: "docs/scope.md",
      text: scope,
      pattern: /The latest validated installable release is \[v(\d+\.\d+\.\d+)\]\(releases\/v(\d+\.\d+\.\d+)\.md\)/,
      description: "scope latest validated release and note link",
    },
    {
      file: "docs/index.md",
      text: index,
      pattern: /\[Latest Release: v(\d+\.\d+\.\d+)\]\(releases\/v(\d+\.\d+\.\d+)\.md\)/,
      description: "documentation-home latest release and note link",
    },
    {
      file: "docs/releases/index.md",
      text: releaseIndex,
      pattern: /The latest validated tagged release is \[v(\d+\.\d+\.\d+)\]\(v(\d+\.\d+\.\d+)\.md\)/,
      description: "release-index validated tag and release note link",
    },
  ];
  if (validatedVersion) {
    for (const claim of versionClaims) checkVersionClaim({ ...claim, expected: validatedVersion, issues });

    const tagRows = releaseIndex.split(/\r?\n/).filter((line) => line.startsWith(`| \`v${validatedVersion}\` |`));
    if (tagRows.length === 0) {
      report(issues, "docs/releases/index.md", 1, `versioned release table is missing validated tag v${validatedVersion}`);
    } else if (tagRows.length > 1) {
      report(issues, "docs/releases/index.md", lineNumber(releaseIndex, releaseIndex.indexOf(tagRows[1])), `validated tag v${validatedVersion} appears more than once in the release table`);
    } else if (!tagRows[0].includes(`[v${validatedVersion} release note](v${validatedVersion}.md)`)) {
      report(issues, "docs/releases/index.md", lineNumber(releaseIndex, releaseIndex.indexOf(tagRows[0])), `v${validatedVersion} row must link its matching versioned release note`);
    }

    await readReleaseNote(root, validatedVersion, "validated", issues);
  }

  const packageClaim = /The current package\/candidate version is `(\d+\.\d+\.\d+)`\./;
  let packageNote = "";
  if (version) {
    checkVersionClaim({
      file: "docs/releases/index.md",
      text: releaseIndex,
      pattern: packageClaim,
      expected: version,
      expectedLabel: "package.json version",
      description: "current package/candidate version",
      issues,
    });
    packageNote = await readReleaseNote(root, version, "package candidate", issues);
  }

  if (version && validatedVersion && packageRelease && validatedRelease && compareVersions(packageRelease, validatedRelease) > 0) {
    checkPrematureValidatedClaim(packageNote, version, validatedVersion, issues);
  }

  if (validatedVersion) {
    const repositoryUrl = typeof packageData.repository === "string" ? packageData.repository : packageData.repository?.url;
    if (typeof packageData.name !== "string" || typeof repositoryUrl !== "string" || !repositoryUrl) {
      report(issues, "package.json", 1, "package name and repository URL are required to derive the canonical stable install command");
    } else {
      const gitUrl = repositoryUrl.startsWith("git+") ? repositoryUrl : `git+${repositoryUrl}`;
      const expectedInstall = `pnpm add -D ${packageData.name}@${gitUrl}#v${validatedVersion}`;
      const installLines = [...readme.matchAll(/^pnpm add -D [^\r\n]+$/gm)];
      if (installLines.length !== 1 || installLines[0]?.[0] !== expectedInstall) {
        const line = installLines[0] ? lineNumber(readme, installLines[0].index) : 1;
        report(issues, "README.md", line, `quickstart install command must be exactly: ${expectedInstall}`);
      }
    }
  }

  const cliReferenceStart = cliReference.indexOf(CLI_REFERENCE_START);
  const taskStates = await collectTaskStates(root, issues);
  checkRoadmapTaskStates(root, roadmap, taskStates, issues);
  if (typeof expectedCliReference === "string") checkCliReference(cliReference, expectedCliReference, issues);
  else report(issues, "src/cli/command-registry.ts", 1, "could not load the canonical CLI reference renderer");

  const examples = contextExamples(cliReference);
  if (examples.length === 0) {
    report(issues, "docs/cli-commands.md", cliReferenceStart === -1 ? 1 : lineNumber(cliReference, cliReferenceStart), "document at least one fenced --context path example");
  }
  for (const example of examples) {
    if (!(await exists(resolve(root, example.path)))) {
      report(issues, "docs/cli-commands.md", example.line, `documented --context path does not exist: ${example.path}`);
    }
  }

  const securityExists = await exists(resolve(root, "SECURITY.md"));
  for (const file of LINK_CHECK_FILES) {
    await checkMarkdownLinks(root, file, documents.get(file) ?? "", securityExists, issues);
  }

  return issues;
}

async function main() {
  const { register } = await import("tsx/esm/api");
  register();
  const { renderCliReferenceSection } = await import("../src/cli/command-registry.ts");
  const issues = await checkDocumentationConsistency(process.cwd(), renderCliReferenceSection());

  if (issues.length > 0) {
    console.error(issues.join("\n"));
    process.exitCode = 1;
    return;
  }

  console.log("Documentation consistency: pass");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
