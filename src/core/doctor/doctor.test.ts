import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runDoctor } from "./index.js";
import { APK_OPERATIONAL_IGNORE_ENTRIES, inspectApkGitignore } from "../init/index.js";
import { inspectApkInstallation } from "./installation.js";
import { detectCompatibility } from "../config/compatibility.js";

async function fixture(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "apk-doctor-"));
  try { await run(root); }
  finally { await rm(root, { recursive: true, force: true }); }
}

const tooling = { devDependencies: { "agentic-project-kit": "github:example/apk#v0.5.1", husky: "9.0.0" } };
const python = "[project]\nname='fixture'\n[build-system]\nrequires=['setuptools']\nbuild-backend='setuptools.build_meta'\n";

test("doctor distinguishes Python/Go applications from APK-only root tooling", async () => {
  for (const runtime of ["Python", "Go"]) {
    await fixture(async (root) => {
      await writeFile(join(root, "package.json"), JSON.stringify(tooling));
      await writeFile(join(root, runtime === "Python" ? "pyproject.toml" : "go.mod"), runtime === "Python" ? python : "module fixture\ngo 1.24\n");
      const result = await runDoctor(root);
      assert.ok(result.checks.some((check) => check.label === "application-stack" && check.message === runtime));
      assert.ok(!result.checks.some((check) => check.label.startsWith("script:")));
    });
  }
});

test("doctor preserves real Node and mixed application script gaps", async () => {
  for (const manifest of [{ main: "index.js" }, { bin: { app: "cli.js" } }, { exports: "./index.js" }, { dependencies: { express: "5.0.0" } }, { scripts: { dev: "vite" }, devDependencies: { vite: "7.0.0", typescript: "6.0.0" } }]) {
    await fixture(async (root) => {
      await writeFile(join(root, "package.json"), JSON.stringify({ ...tooling, ...manifest }));
      await writeFile(join(root, "pyproject.toml"), python);
      const result = await runDoctor(root);
      assert.equal(result.checks.filter((check) => check.label.startsWith("script:") && check.message === "missing").length, 4);
      assert.ok(result.checks.some((check) => check.label === "application-stack" && check.message === "Node.js, Python"));
    });
  }
});

test("doctor checks nested Node application scripts at their owning manifest", async () => {
  await fixture(async (root) => {
    await writeFile(join(root, "package.json"), JSON.stringify(tooling));
    await writeFile(join(root, "pyproject.toml"), python);
    await mkdir(join(root, "frontend"));
    await writeFile(join(root, "frontend/package.json"), JSON.stringify({ main: "index.js", scripts: { test: "node --test" } }));
    const result = await runDoctor(root);
    assert.ok(result.checks.some((check) => check.label === "script:frontend:test" && check.level === "pass"));
    assert.equal(result.checks.filter((check) => check.label.startsWith("script:frontend:") && check.level === "warn").length, 3);
    assert.ok(!result.checks.some((check) => check.label === "script:test"));
  });
});

test("doctor reports ambiguous or malformed inventory without inventing Node application evidence", async () => {
  for (const text of ["", "[project", "description = 'unfinished"]) {
    await fixture(async (root) => {
      await writeFile(join(root, "pyproject.toml"), text);
      await writeFile(join(root, "package.json"), "{}");
      const result = await runDoctor(root);
      assert.ok(result.checks.some((check) => check.label === "application-stack" && check.level === "warn"));
      assert.ok(!result.checks.some((check) => check.label.startsWith("script:")));
      await writeFile(join(root, "package.json"), "{malformed");
      const broken = await runDoctor(root);
      assert.ok(broken.checks.some((check) => check.label === "application-stack" && check.message.includes("unavailable")));
    });
  }
});

test("doctor honors explicit application ownership and does not execute project commands or create files", async () => {
  await fixture(async (root) => {
    await mkdir(join(root, ".agentic"));
    await writeFile(join(root, ".agentic/config.json"), JSON.stringify({ projectName: "Fixture", defaultMode: "mvp", taskDirectory: ".tasks", docsDirectory: "docs", runtimeManifestRole: "application" }));
    const command = "node -e \"require('fs').writeFileSync('SHOULD_NOT_EXIST','executed')\"";
    await writeFile(join(root, "package.json"), JSON.stringify({ ...tooling, scripts: { test: command, lint: command, typecheck: command, build: command } }));
    await writeFile(join(root, "pyproject.toml"), python);
    const files = (await readdir(root, { recursive: true })).sort();
    const before = await Promise.all(files.filter((file) => file.endsWith(".json") || file.endsWith(".toml")).map((file) => readFile(join(root, file), "utf8")));
    const result = await runDoctor(root);
    assert.equal(result.checks.filter((check) => check.label.startsWith("script:") && check.level === "pass").length, 4);
    assert.deepEqual((await readdir(root, { recursive: true })).sort(), files);
    assert.deepEqual(await Promise.all(files.filter((file) => file.endsWith(".json") || file.endsWith(".toml")).map((file) => readFile(join(root, file), "utf8"))), before);
  });
});

test("doctor retains missing script warnings for a standalone Node CLI", async () => {
  await fixture(async (root) => {
    await writeFile(join(root, "package.json"), JSON.stringify({ bin: "./cli.js" }));
    const result = await runDoctor(root);
    assert.ok(result.checks.some((check) => check.label === "application-stack" && check.message === "Node.js"));
    assert.equal(result.checks.filter((check) => check.label.startsWith("script:") && check.level === "warn").length, 4);
  });
});

const apkPin = "github:HaidaDaniel/AgenticProjectKit#v0.5.1";
const apkResolution = `https://codeload.github.com/HaidaDaniel/AgenticProjectKit/tar.gz/${"a".repeat(40)}`;
function lockFixture(pin = apkPin, version = apkResolution): string {
  return `lockfileVersion: '9.0'\nimporters:\n  .:\n    devDependencies:\n      agentic-project-kit:\n        specifier: ${pin}\n        version: ${version}\n`;
}

async function pinnedFixture(root: string): Promise<void> {
  await writeFile(join(root, "package.json"), JSON.stringify({ devDependencies: { "agentic-project-kit": apkPin } }));
  await writeFile(join(root, "pnpm-lock.yaml"), lockFixture());
}

test("installation distinguishes pinned/locked metadata, local payload and version mismatch", async () => {
  await fixture(async (root) => {
    await pinnedFixture(root);
    let report = await inspectApkInstallation(root);
    assert.equal(report.declared, "pinned");
    assert.equal(report.locked, "matched");
    assert.equal(report.present, "absent");
    assert.ok(report.findings.some((finding) => finding.code === "pinned-declaration" && finding.message.includes("not an observed install")));
    await mkdir(join(root, "node_modules/agentic-project-kit/dist/cli"), { recursive: true });
    await writeFile(join(root, "node_modules/agentic-project-kit/dist/cli/index.js"), "throw new Error('must never execute');\n");
    await writeFile(join(root, "node_modules/agentic-project-kit/package.json"), JSON.stringify({ name: "agentic-project-kit", version: "0.5.0" }));
    report = await inspectApkInstallation(root);
    assert.equal(report.present, "present");
    assert.ok(report.findings.some((finding) => finding.code === "installed-version-mismatch"));
  });
});

test("installation keeps stale locks, mutable pins and unsupported lock syntax unresolved", async () => {
  const locks = [
    { text: lockFixture(apkPin.replace("0.5.1", "0.5.0")), status: "mismatch" },
    { text: lockFixture(apkPin, apkResolution.replace("HaidaDaniel/AgenticProjectKit", "someone/other")), status: "mismatch" },
    { text: lockFixture().replace("'9.0'", "'6.0'"), status: "unknown" },
    { text: `${lockFixture()}importers:\n  .:\n`, status: "unknown" },
    { text: lockFixture().replace("    devDependencies:", "    unsupported:"), status: "unknown" },
    { text: lockFixture().replace(`specifier: ${apkPin}`, "specifier: *alias"), status: "unknown" },
  ];
  for (const { text, status } of locks) {
    await fixture(async (root) => {
      await pinnedFixture(root);
      await writeFile(join(root, "pnpm-lock.yaml"), text);
      const report = await inspectApkInstallation(root);
      assert.equal(report.locked, status, text);
      assert.ok(!report.findings.some((finding) => finding.code === "pinned-declaration"));
    });
  }
  await fixture(async (root) => {
    await pinnedFixture(root);
    await rm(join(root, "pnpm-lock.yaml"));
    await writeFile(join(root, "package-lock.json"), "{}");
    assert.equal((await inspectApkInstallation(root)).locked, "unknown");
    await writeFile(join(root, "package.json"), JSON.stringify({ devDependencies: { "agentic-project-kit": "^0.5.1" } }));
    assert.equal((await inspectApkInstallation(root)).declared, "unfixed");
  });
});

test("upgrade acceptance separates pinned, legacy, and unpinned installations", async () => {
  await fixture(async (root) => {
    await pinnedFixture(root);
    const installation = await inspectApkInstallation(root);
    assert.equal(installation.declared, "pinned");
    assert.equal(installation.locked, "matched");
    assert.ok(installation.findings.some((finding) => finding.code === "pinned-declaration"));
  });

  await fixture(async (root) => {
    await cp(join(process.cwd(), "src/core/tasks/fixtures/v0.3.1"), root, { recursive: true });
    await pinnedFixture(root);
    const compatibility = await detectCompatibility(root);
    assert.equal(compatibility.overall, "legacy");
    assert.equal(compatibility.migrationRequired, true);
    const installation = await inspectApkInstallation(root);
    assert.equal(installation.declared, "pinned");
    assert.equal(installation.locked, "matched");
  });

  await fixture(async (root) => {
    await writeFile(
      join(root, "README.md"),
      "Install APK separately from github:HaidaDaniel/AgenticProjectKit#v0.5.2 before running apkit tasks.\n",
    );
    const installation = await inspectApkInstallation(root);
    assert.equal(installation.declared, "absent");
    assert.ok(installation.findings.some((finding) => finding.code === "external-prerequisite" && finding.message.includes("reference is present")));
    assert.ok(!installation.findings.some((finding) => finding.code === "pinned-declaration"));
  });
});

test("installation recognizes external prerequisites without treating PATH as installation evidence", async () => {
  await fixture(async (root) => {
    await writeFile(join(root, "README.md"), "After installing the kit, run apkit tasks.\n");
    let report = await inspectApkInstallation(root);
    assert.ok(report.findings.some((finding) => finding.code === "external-prerequisite" && finding.message.includes("no supported exact")));
    assert.ok(!report.findings.some((finding) => finding.code === "installation-undeclared"));
    await writeFile(join(root, "README.md"), "Install APK separately from github:HaidaDaniel/AgenticProjectKit#v0.5.1.\n");
    report = await inspectApkInstallation(root);
    assert.ok(report.findings.some((finding) => finding.code === "external-prerequisite" && finding.message.includes("reference is present")));
    await writeFile(join(root, "AGENTS.md"), "Run pnpm exec apk tasks.\n");
    report = await inspectApkInstallation(root);
    assert.ok(report.findings.some((finding) => finding.code === "local-invocation-unresolved"));
  });
});

test("installation separates missing literal launcher payloads from dynamic and external targets", async () => {
  await fixture(async (root) => {
    await mkdir(join(root, "scripts"));
    await writeFile(join(root, "AGENTS.md"), "Use pnpm exec apk tasks.\n");
    await writeFile(join(root, "scripts/apk.sh"), '#!/bin/sh\nexec node ".tools/AgenticProjectKit/dist/cli/index.js" "$@"\n');
    let report = await inspectApkInstallation(root);
    assert.ok(report.findings.some((finding) => finding.code === "launcher-payload-unavailable" && finding.paths.includes(".tools/AgenticProjectKit/dist/cli/index.js")));
    assert.ok(report.findings.some((finding) => finding.code === "launcher-disagreement"));
    await writeFile(join(root, "scripts/apk.sh"), '#!/bin/sh\nnode "$APK_HOME/dist/cli/index.js" "$@"\ntouch SHOULD_NOT_EXIST\n');
    report = await inspectApkInstallation(root);
    assert.ok(report.findings.some((finding) => finding.code === "launcher-dynamic"));
    await fixture(async (outside) => {
      await writeFile(join(outside, "cli.js"), "private contents must never be printed");
      await symlink(join(outside, "cli.js"), join(root, "external.js"));
      await writeFile(join(root, "scripts/apk.sh"), 'node external.js "$@"\n');
      report = await inspectApkInstallation(root);
      assert.ok(report.findings.some((finding) => finding.code === "launcher-payload-unavailable" && finding.message.includes("unknown")));
      assert.ok(!JSON.stringify(report).includes("private contents"));
    });
    assert.ok(!(await readdir(root)).includes("SHOULD_NOT_EXIST"));
  });
});

test("installation bounded reads and doctor remain non-mutating with actionable missing declaration", async () => {
  await fixture(async (root) => {
    await writeFile(join(root, "README.md"), "Use pnpm exec apkit tasks.\n");
    await writeFile(join(root, "pyproject.toml"), python);
    const before = (await readdir(root)).sort();
    const report = await inspectApkInstallation(root);
    const doctor = await runDoctor(root);
    assert.ok(report.findings.some((finding) => finding.code === "installation-undeclared"));
    assert.ok(doctor.checks.some((check) => check.label === "installation:installation-undeclared"));
    assert.deepEqual((await readdir(root)).sort(), before);
    await writeFile(join(root, "README.md"), "x".repeat(64 * 1024 + 1));
    assert.ok((await inspectApkInstallation(root)).findings.some((finding) => finding.code === "instructions-unknown"));
    await writeFile(join(root, "package.json"), "{bad json");
    assert.equal((await inspectApkInstallation(root)).declared, "unknown");
  });
});


test("doctor reports shared indexed operational categories as advisory warnings", async () => {
  await fixture(async (root) => {
    const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
    git("init", "-q");
    await mkdir(join(root, ".agentic/runs"), { recursive: true });
    await mkdir(join(root, "docs"));
    await writeFile(join(root, ".agentic/runs/sample.jsonl"), "abc");
    await writeFile(join(root, "docs/project-map.md"), "map");
    git("add", "--", ".agentic/runs/sample.jsonl", "docs/project-map.md");
    const index = git("ls-files", "--stage", "-z");
    const doctor = await runDoctor(root);
    const check = doctor.checks.find((item) => item.label === "tracked-operational-artifacts")!;
    assert.equal(check.level, "warn");
    assert.match(check.message, /count=2; indexed bytes=6/);
    assert.match(check.message, /runs: count=1/);
    assert.match(check.message, /generated-docs: count=1/);
    assert.match(check.message, /back up needed local evidence/);
    assert.equal(check.message, (await inspectApkGitignore(root)).diagnostics.join("\n  "));
    assert.equal(git("ls-files", "--stage", "-z"), index);
    assert.equal(await readFile(join(root, ".agentic/runs/sample.jsonl"), "utf8"), "abc");
  });
});

const canonicalIgnore = `${APK_OPERATIONAL_IGNORE_ENTRIES.join("\n")}\n`;

function oracleProbePath(entry: string): string {
  if (entry.startsWith("!")) return entry.substring(1);
  const withoutRoot = entry.replace(/^\//, "");
  if (withoutRoot.endsWith("/*")) return `${withoutRoot.slice(0, -2)}/probe-file`;
  if (withoutRoot.endsWith("/")) return `${withoutRoot}probe-file`;
  return withoutRoot;
}

function gitIgnoreOracle(root: string, entry: string): { ignored: boolean; reinclude: boolean } {
  const probe = oracleProbePath(entry);
  try {
    const output = execFileSync("git", ["check-ignore", "-v", "--no-index", probe], {
      cwd: root,
      encoding: "utf8",
    });
    const pattern = (output.trim().split(/\s+/)[0] ?? "").split(":").slice(2).join(":");
    return { ignored: !pattern.startsWith("!"), reinclude: pattern.startsWith("!") };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "status" in error && error.status === 1) {
      return { ignored: false, reinclude: false };
    }
    throw error;
  }
}

async function ignoreCheck(root: string) {
  const result = await runDoctor(root);
  const check = result.checks.find((item) => item.label === "ignore-entries");
  assert.ok(check, "doctor must emit an ignore-entries check");
  return check;
}

async function withGitEnv<T>(run: () => Promise<T>): Promise<T> {
  const saved = {
    GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL,
    GIT_CONFIG_NOSYSTEM: process.env.GIT_CONFIG_NOSYSTEM,
  };
  process.env.GIT_CONFIG_GLOBAL = "/dev/null";
  process.env.GIT_CONFIG_NOSYSTEM = "1";
  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("doctor reports canonical ignore entries present as pass without probing", async () => {
  await withGitEnv(async () => {
    await fixture(async (root) => {
      execFileSync("git", ["init", "-q"], { cwd: root });
      await writeFile(join(root, ".gitignore"), canonicalIgnore);
      const check = await ignoreCheck(root);
      assert.equal(check.level, "pass");
      assert.match(check.message, /canonical operational ignore entries present/);
      assert.doesNotMatch(check.message, /effectively|unavailable/);
    });
  });
});

test("doctor warns for a partially missing ignore entry and names the safe fix path", async () => {
  await withGitEnv(async () => {
    await fixture(async (root) => {
      execFileSync("git", ["init", "-q"], { cwd: root });
      await writeFile(join(root, ".gitignore"), canonicalIgnore.replace("/tmp/apk/\n", ""));
      const check = await ignoreCheck(root);
      assert.equal(check.level, "warn");
      assert.match(check.message, /\/tmp\/apk\//);
      assert.match(check.message, /apk init or apk adopt/);
    });
  });
});

test("doctor warns for a missing .gitignore and probes effective ignore", async () => {
  await withGitEnv(async () => {
    await fixture(async (root) => {
      execFileSync("git", ["init", "-q"], { cwd: root });
      const check = await ignoreCheck(root);
      assert.equal(check.level, "warn");
      assert.match(check.message, /\.tasks\/\.apk\.lock/);
      assert.match(check.message, /docs\/audit-report\.md/);
    });
  });
});

test("doctor treats a broad root ignore pattern as proven effective ignore", async () => {
  await withGitEnv(async () => {
    await fixture(async (root) => {
      execFileSync("git", ["init", "-q"], { cwd: root });
      await writeFile(join(root, ".gitignore"), "*\n!.agentic/\n!.agentic/agents/\n!.agentic/agents/.gitkeep\n!.agentic/runs/\n!.agentic/runs/.gitkeep\n");
      const check = await ignoreCheck(root);
      assert.equal(check.level, "pass");
      assert.match(check.message, /absent as literal strings/);
      assert.match(check.message, /\.gitignore:1:\*/);
    });
  });
});

test("doctor accepts equivalent rules from .git/info/exclude including re-include rules", async () => {
  await withGitEnv(async () => {
    await fixture(async (root) => {
      execFileSync("git", ["init", "-q"], { cwd: root });
      await mkdir(join(root, ".git/info"), { recursive: true });
      await writeFile(join(root, ".gitignore"), "\n");
      await writeFile(join(root, ".git/info/exclude"), canonicalIgnore);
      const check = await ignoreCheck(root);
      assert.equal(check.level, "pass");
      assert.match(check.message, /re-included via \.git\/info\/exclude:\d+:!\.agentic\/agents\/\.gitkeep/);
      assert.match(check.message, /ignored via \.git\/info\/exclude:\d+:\/tmp\/apk\//);
    });
  });
});

test("doctor accepts a nested .gitignore as an equivalent effective rule", async () => {
  await withGitEnv(async () => {
    await fixture(async (root) => {
      execFileSync("git", ["init", "-q"], { cwd: root });
      await writeFile(join(root, ".gitignore"), "\n");
      await mkdir(join(root, ".agentic"), { recursive: true });
      await writeFile(join(root, ".agentic/.gitignore"), "evidence.jsonl\n");
      const check = await ignoreCheck(root);
      assert.equal(check.level, "warn");
      const unproven = check.message.split(" Proven:")[0];
      assert.doesNotMatch(unproven, /\.agentic\/evidence\.jsonl/);
      assert.match(unproven, /\.agentic\/agents\/sample|\.tasks\/\.apk\.lock/);
      assert.match(check.message, /Proven:.*\.agentic\/\.gitignore:1:evidence\.jsonl/);
    });
  });
});

test("doctor never reports a leak when re-include negation is proven", async () => {
  await withGitEnv(async () => {
    await fixture(async (root) => {
      execFileSync("git", ["init", "-q"], { cwd: root });
      const rootIgnore = canonicalIgnore
        .replace("!.agentic/agents/.gitkeep\n", "")
        .replace("!.agentic/runs/.gitkeep\n", "");
      await writeFile(join(root, ".gitignore"), rootIgnore);
      await mkdir(join(root, ".agentic"), { recursive: true });
      await writeFile(join(root, ".agentic/.gitignore"), "!.gitkeep\n");
      const check = await ignoreCheck(root);
      assert.equal(check.level, "pass");
      assert.match(check.message, /re-included via \.agentic\/\.gitignore:1:!\.gitkeep/);
    });
  });
});

test("doctor does not prove a missing entry from another entry's probe", async () => {
  await withGitEnv(async () => {
    await fixture(async (root) => {
      execFileSync("git", ["init", "-q"], { cwd: root });
      await writeFile(join(root, ".gitignore"), canonicalIgnore.replace(".agentic/perf/*\n", ""));
      const check = await ignoreCheck(root);

      assert.equal(check.level, "warn");
      assert.match(check.message, /\.agentic\/perf\/\*/);
      assert.doesNotMatch(check.message, /\.agentic\/perf\/\*: ignored via/);
    });
  });
});

test("doctor ignore verdicts match an independently constructed Git oracle", async () => {
  await withGitEnv(async () => {
    await fixture(async (root) => {
      execFileSync("git", ["init", "-q"], { cwd: root });
      const present = APK_OPERATIONAL_IGNORE_ENTRIES.filter(
        (entry) => entry !== ".agentic/perf/*" && entry !== "/tmp/apk/",
      );
      await writeFile(join(root, ".gitignore"), `${present.join("\n")}\n`);
      const check = await ignoreCheck(root);
      const expectedUnproven = APK_OPERATIONAL_IGNORE_ENTRIES.filter((entry) => {
        const oracle = gitIgnoreOracle(root, entry);
        return entry.startsWith("!") ? !oracle.reinclude : !oracle.ignored;
      });

      assert.equal(check.level, "warn");
      for (const entry of expectedUnproven) {
        assert.ok(check.message.includes(entry), `warn must name ${entry}`);
      }
      assert.match(check.message, /\.agentic\/perf\/\*/);
    });
  });
});

test("doctor rejects a re-include pattern that matches a different path", async () => {
  await withGitEnv(async () => {
    await fixture(async (root) => {
      execFileSync("git", ["init", "-q"], { cwd: root });
      await writeFile(
        join(root, ".gitignore"),
        canonicalIgnore.replace("!.agentic/agents/.gitkeep\n", "!.agentic/runs/.gitkeep-extra\n"),
      );
      const check = await ignoreCheck(root);

      assert.equal(check.level, "warn");
      assert.match(check.message, /!\.agentic\/agents\/\.gitkeep/);
      assert.doesNotMatch(check.message, /!\.agentic\/agents\/\.gitkeep: re-included/);
    });
  });
});

test("doctor warns when git check-ignore exits 128 instead of claiming effective ignore", async () => {
  await withGitEnv(async () => {
    await fixture(async (root) => {
      const realGit = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
      const fakeBin = await mkdtemp(join(tmpdir(), "apk-doctor-git-"));
      try {
        execFileSync("git", ["init", "-q"], { cwd: root });
        await writeFile(join(root, ".gitignore"), "\n");
        await writeFile(join(fakeBin, "git"), `#!/bin/sh\ncase "$*" in *check-ignore*) exit 128;; esac\nexec "${realGit}" "$@"\n`, { mode: 0o755 });
        const savedPath = process.env.PATH;
        process.env.PATH = `${fakeBin}:${savedPath ?? ""}`;
        try {
          const check = await ignoreCheck(root);
          assert.equal(check.level, "warn");
          assert.match(check.message, /exited 128/);
          assert.doesNotMatch(check.message, /effectively ignored|ignored via/);
        } finally {
          process.env.PATH = savedPath;
        }
      } finally {
        await rm(fakeBin, { recursive: true, force: true });
      }
    });
  });
});

test("doctor warns when git is absent and never reports pass for ignore entries", async () => {
  await withGitEnv(async () => {
    await fixture(async (root) => {
      const savedPath = process.env.PATH;
      process.env.PATH = "";
      try {
        const check = await ignoreCheck(root);
        assert.equal(check.level, "warn");
        assert.match(check.message, /git is not available/);
      } finally {
        process.env.PATH = savedPath;
      }
    });
  });
});

test("doctor ignore inspection is byte-for-byte read-only", async () => {
  await withGitEnv(async () => {
    await fixture(async (root) => {
      execFileSync("git", ["init", "-q"], { cwd: root });
      await writeFile(join(root, ".gitignore"), canonicalIgnore.replace("/tmp/apk/\n", ""));
      await writeFile(join(root, "README.md"), "unchanged\n");
      const before = await readdir(root);
      const ignoreBefore = await readFile(join(root, ".gitignore"), "utf8");
      const readmeBefore = await readFile(join(root, "README.md"), "utf8");
      await runDoctor(root);
      assert.deepEqual(await readdir(root), before);
      assert.equal(await readFile(join(root, ".gitignore"), "utf8"), ignoreBefore);
      assert.equal(await readFile(join(root, "README.md"), "utf8"), readmeBefore);
    });
  });
});
