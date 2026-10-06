import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import test from "node:test";

import {
  getPackagedSkill,
  listPackagedSkills,
  materializePackagedSkill,
  readPackagedSkillContent,
} from "./index.js";

async function withTempDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "apk-skills-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true, maxRetries: 5, retryDelay: 20 });
  }
}

test("packaged skill registry discovers every canonical SKILL.md.hbs asset", async () => {
  const skills = await listPackagedSkills();

  assert.deepEqual(skills.map((skill) => skill.id), [
    "apk-milestone-semantic-audit",
    "apk-project-grill",
    "apk-prototype",
    "apk-task-author",
    "apk-task-grill",
    "apk-task-split",
  ]);

  for (const skill of skills) {
    assert.match(skill.source, new RegExp(`^core/templates/skills/${skill.id}/SKILL\\.md\\.hbs$`));
    assert.equal(skill.destination, `.agents/skills/${skill.id}/SKILL.md`);
    const rendered = await readPackagedSkillContent(skill.id);
    assert.equal(rendered.skill.id, skill.id);
    assert.doesNotMatch(rendered.content, /\{\{|\}\}/);
  }
});

test("materialization previews without mutation, applies idempotently, and protects conflicts", async () => {
  await withTempDirectory(async (directory) => {
    const project = join(directory, "repository with spaces");
    await mkdir(project, { recursive: true });

    const preview = await materializePackagedSkill(project, "apk-task-author");
    const destination = join(project, ".agents/skills/apk-task-author/SKILL.md");
    assert.equal(preview.status, "create");
    assert.equal(preview.written, false);
    await assert.rejects(stat(destination), { code: "ENOENT" });

    const applied = await materializePackagedSkill(project, "apk-task-author", { apply: true });
    assert.equal(applied.status, "create");
    assert.equal(applied.written, true);
    const generated = await readFile(destination, "utf8");
    assert.match(generated, /^---\nname: apk-task-author\n/);
    assert.doesNotMatch(generated, /\{\{|\}\}/);

    const repeated = await materializePackagedSkill(project, "apk-task-author");
    assert.equal(repeated.status, "no-op");
    assert.equal(repeated.written, false);

    await writeFile(destination, "custom project instructions\n", "utf8");
    const conflictPreview = await materializePackagedSkill(project, "apk-task-author");
    assert.equal(conflictPreview.status, "customized-conflict");
    assert.equal(await readFile(destination, "utf8"), "custom project instructions\n");

    const refused = await materializePackagedSkill(project, "apk-task-author", { apply: true });
    assert.equal(refused.status, "customized-conflict");
    assert.equal(refused.written, false);
    assert.equal(await readFile(destination, "utf8"), "custom project instructions\n");

    const forced = await materializePackagedSkill(project, "apk-task-author", { apply: true, force: true });
    assert.equal(forced.status, "update");
    assert.equal(forced.written, true);
    assert.equal(await readFile(destination, "utf8"), generated);
  });
});

test("unknown skill names fail closed before any project write", async () => {
  await withTempDirectory(async (directory) => {
    await assert.rejects(
      getPackagedSkill("not-a-real-skill"),
      /Unknown packaged skill: not-a-real-skill/,
    );
    await assert.rejects(
      materializePackagedSkill(directory, "../outside"),
      /Invalid skill name/,
    );
  });
});
