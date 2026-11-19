import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const CLI = new URL("../../dist/cli/index.js", import.meta.url).pathname;
const root = await mkdtemp(join(tmpdir(), "apk-verdict-fixture-"));

async function run(cwd, args) {
  try {
    const { stdout } = await exec("node", [CLI, ...args], { cwd });
    return { code: 0, stdout: stdout.trim() };
  } catch (error) {
    return { code: error.code ?? 1, stdout: String(error.stderr ?? error.message).trim() };
  }
}

try {
  const repo = join(root, "repo");
  const outside = join(root, "outside");
  await mkdir(repo, { recursive: true });
  await mkdir(outside, { recursive: true });
  const { renderLegacyAgentExportFile, DEFAULT_AGENT_POLICY } = await import("../../dist/core/exporters/index.js");
  const generated = await renderLegacyAgentExportFile("codex", DEFAULT_AGENT_POLICY);
  await writeFile(join(outside, "instructions.md"), generated, "utf8");
  await symlink("../outside", join(repo, ".codex"), "dir");
  const cleanup = await run(repo, ["export", "--cleanup-legacy"]);
  const marker = await (await import("node:fs/promises")).readFile(join(outside, "instructions.md"), "utf8");
  console.log(JSON.stringify({
    case: "legacy-deletion-escape",
    expected: "refuse and preserve marker",
    observed: { exit: cleanup.code, message: cleanup.stdout,     markerIntact: marker === generated },
  }, null, 2));

  const doctorRepo = join(root, "doctor");
  await mkdir(join(doctorRepo, ".agentic"), { recursive: true });
  await mkdir(join(doctorRepo, ".tasks"), { recursive: true });
  await writeFile(join(doctorRepo, ".agentic/config.json"), "{}", "utf8");
  await exec("git", ["init", "-q"], { cwd: doctorRepo });
  const { APK_OPERATIONAL_IGNORE_ENTRIES } = await import("../../dist/core/init/index.js");
  const present = APK_OPERATIONAL_IGNORE_ENTRIES.filter((entry) => entry !== ".agentic/perf/*");
  await writeFile(join(doctorRepo, ".gitignore"), `${present.join("\n")}\n`, "utf8");
  const doctor = await run(doctorRepo, ["doctor"]);
  console.log(JSON.stringify({
    case: "ignore-rule-family-false-pass",
    expected: "warn for uncited canonical entries",
    observed: { exit: doctor.code, lines: doctor.stdout.split("\n").filter((line) => /ignore-entries/.test(line)) },
  }, null, 2));
} finally {
  await rm(root, { recursive: true, force: true });
}
