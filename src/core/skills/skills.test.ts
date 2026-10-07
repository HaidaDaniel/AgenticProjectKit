import { link, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
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

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
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

test("Windows fallback materializes paths with spaces and rejects redirects", async () => {
  await withTempDirectory(async (directory) => {
    const project = join(directory, "Windows project with spaces");
    await mkdir(project, { recursive: true });
    const platform = "win32" as const;
    const destination = join(project, ".agents/skills/apk-task-author/SKILL.md");

    const preview = await materializePackagedSkill(project, "apk-task-author", { platform });
    assert.equal(preview.status, "create");
    assert.equal(preview.written, false);
    const applied = await materializePackagedSkill(project, "apk-task-author", { apply: true, platform });
    assert.equal(applied.status, "create");
    assert.equal(applied.written, true);
    const generated = await readFile(destination, "utf8");
    assert.equal(
      (await materializePackagedSkill(project, "apk-task-author", { apply: true, platform })).status,
      "no-op",
    );

    await writeFile(destination, "customized\n", "utf8");
    assert.equal(
      (await materializePackagedSkill(project, "apk-task-author", { apply: true, platform })).status,
      "customized-conflict",
    );
    const forced = await materializePackagedSkill(project, "apk-task-author", { apply: true, force: true, platform });
    assert.equal(forced.status, "update");
    assert.equal(await readFile(destination, "utf8"), generated);

    const parentRedirectProject = join(directory, "parent redirect");
    const outside = join(directory, "outside");
    await mkdir(outside, { recursive: true });
    await mkdir(join(parentRedirectProject, ".agents"), { recursive: true });
    await symlink(outside, join(parentRedirectProject, ".agents/skills"), "dir");
    await assert.rejects(
      materializePackagedSkill(parentRedirectProject, "apk-task-author", { apply: true, platform }),
      /symbolic-link directory|redirected destination ancestor/,
    );

    const finalRedirectProject = join(directory, "final redirect");
    const finalDirectory = join(finalRedirectProject, ".agents/skills/apk-task-author");
    const finalOutside = join(directory, "final-outside.md");
    await mkdir(finalDirectory, { recursive: true });
    await writeFile(finalOutside, "outside\n", "utf8");
    await symlink(finalOutside, join(finalDirectory, "SKILL.md"), "file");
    await assert.rejects(
      materializePackagedSkill(finalRedirectProject, "apk-task-author", { apply: true, force: true, platform }),
      /symbolic link/,
    );
    assert.equal(await readFile(finalOutside, "utf8"), "outside\n");

    const hardlinkProject = join(directory, "hardlink project");
    const hardlinkDirectory = join(hardlinkProject, ".agents/skills/apk-task-author");
    const hardlinkOutside = join(directory, "hardlink-outside.md");
    await mkdir(hardlinkDirectory, { recursive: true });
    await writeFile(hardlinkOutside, "outside\n", "utf8");
    await link(hardlinkOutside, join(hardlinkDirectory, "SKILL.md"));
    await assert.rejects(
      materializePackagedSkill(hardlinkProject, "apk-task-author", { apply: true, force: true, platform }),
      /hard-linked destination/,
    );
    assert.equal(await readFile(hardlinkOutside, "utf8"), "outside\n");
  });
});

test("every materialized skill matches its canonical rendered source", async () => {
  await withTempDirectory(async (directory) => {
    for (const skill of await listPackagedSkills()) {
      const expected = await readPackagedSkillContent(skill.id);
      const result = await materializePackagedSkill(directory, skill.id, { apply: true });
      assert.equal(result.status, "create");
      assert.equal(
        normalizeLineEndings(await readFile(join(directory, skill.destination), "utf8")),
        normalizeLineEndings(expected.content),
      );
    }
  });
});

test("materialization refuses symlinked destination parents before writing", async () => {
  await withTempDirectory(async (directory) => {
    const outside = join(directory, "outside");
    const agents = join(directory, ".agents");
    await mkdir(outside, { recursive: true });
    await mkdir(agents, { recursive: true });
    await symlink(outside, join(agents, "skills"), "dir");

    await assert.rejects(
      materializePackagedSkill(directory, "apk-task-author", { apply: true }),
      /symbolic-link directory/,
    );
    await assert.rejects(
      stat(join(outside, "apk-task-author", "SKILL.md")),
      { code: "ENOENT" },
    );
  });
});

test("materialization refuses a symlinked final destination", async () => {
  await withTempDirectory(async (directory) => {
    const destinationDirectory = join(directory, ".agents/skills/apk-task-author");
    const outside = join(directory, "outside.md");
    const destination = join(destinationDirectory, "SKILL.md");
    await mkdir(destinationDirectory, { recursive: true });
    await writeFile(outside, "outside content\n", "utf8");
    await symlink(outside, destination, "file");

    await assert.rejects(
      materializePackagedSkill(directory, "apk-task-author", { apply: true, force: true }),
      /symbolic link/,
    );
    assert.equal(await readFile(outside, "utf8"), "outside content\n");
  });
});

test("materialization refuses a hardlinked final destination", async () => {
  await withTempDirectory(async (directory) => {
    const destinationDirectory = join(directory, ".agents/skills/apk-task-author");
    const outside = join(directory, "outside.md");
    const destination = join(destinationDirectory, "SKILL.md");
    await mkdir(destinationDirectory, { recursive: true });
    await writeFile(outside, "outside content\n", "utf8");
    await link(outside, destination);

    await assert.rejects(
      materializePackagedSkill(directory, "apk-task-author", { apply: true, force: true }),
      /hard-linked destination/,
    );
    assert.equal(await readFile(outside, "utf8"), "outside content\n");
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
