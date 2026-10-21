import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runDoctor } from "./index.js";

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
