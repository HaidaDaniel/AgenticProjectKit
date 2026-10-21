import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runDoctor } from "./index.js";
import { inspectApkInstallation } from "./installation.js";

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
