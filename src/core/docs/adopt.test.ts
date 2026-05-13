import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { listAgentExporters } from "../exporters/index.js";
import { adoptRepository } from "./adopt.js";

async function withTempRepository(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-adopt-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

async function createExistingRepository(directory: string): Promise<void> {
  await mkdir(join(directory, "src"), { recursive: true });
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify(
      {
        dependencies: {
          react: "^19.0.0",
        },
        devDependencies: {
          typescript: "^6.0.0",
          vite: "^7.0.0",
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(join(directory, "tsconfig.json"), "{}\n", "utf8");
  await writeFile(join(directory, "src/index.ts"), "console.log('app');\n", "utf8");
}

test("adoptRepository scans repository shape and creates kit files", async () => {
  await withTempRepository(async (directory) => {
    await createExistingRepository(directory);

    const result = await adoptRepository(directory);

    assert.deepEqual(result.scan.detectedStack, [
      "Node.js",
      "React",
      "TypeScript",
      "Vite",
    ]);
    assert.ok(result.created.includes("docs/project-map.md"));
    assert.ok(result.created.includes("docs/adoption-report.md"));
    assert.ok(result.created.includes("docs/project.md"));
    assert.ok(result.created.includes("docs/scope.md"));
    assert.ok(result.created.includes("docs/architecture.md"));
    assert.ok(result.created.includes(".agentic/config.json"));
    assert.ok(result.created.includes(".tasks/0001-document-adopted-repository.md"));
    assert.ok(result.created.includes("AGENTS.md"));
    assert.equal(
      await readFile(join(directory, "src/index.ts"), "utf8"),
      "console.log('app');\n",
    );
    assert.match(
      await readFile(join(directory, "docs/project-map.md"), "utf8"),
      /## Detected Stack\n\n- Node\.js\n- React\n- TypeScript\n- Vite/,
    );
    assert.match(
      await readFile(join(directory, "docs/project.md"), "utf8"),
      /Adopted repository:/,
    );
    assert.match(
      await readFile(join(directory, "docs/adoption-report.md"), "utf8"),
      new RegExp(`## Pre-adoption Gaps\\n\\n- Missing kit docs: 8\\n- Missing agent exports: ${listAgentExporters().length}`),
    );
  });
});

test("adoptRepository skips existing files instead of overwriting them", async () => {
  await withTempRepository(async (directory) => {
    await createExistingRepository(directory);
    await writeFile(join(directory, "AGENTS.md"), "custom instructions\n", "utf8");

    const result = await adoptRepository(directory);

    assert.ok(result.skipped.includes("AGENTS.md"));
    assert.equal(
      await readFile(join(directory, "AGENTS.md"), "utf8"),
      "custom instructions\n",
    );
    assert.ok(result.created.includes("docs/adoption-report.md"));
  });
});
