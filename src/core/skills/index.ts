import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { renderTemplateFile } from "../templates/index.js";

export const PROJECT_SKILLS_DIRECTORY = ".agents/skills";
export const PACKAGED_SKILLS_SOURCE_DIRECTORY = "core/templates/skills";

export interface PackagedSkill {
  id: string;
  sourcePath: string;
  source: string;
  destination: string;
}

export type SkillMaterializationStatus =
  | "create"
  | "no-op"
  | "update"
  | "customized-conflict";

export interface MaterializeSkillOptions {
  apply?: boolean;
  force?: boolean;
}

export interface MaterializeSkillResult {
  skill: PackagedSkill;
  status: SkillMaterializationStatus;
  applied: boolean;
  written: boolean;
}

const packagedSkillDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "templates",
  "skills",
);

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function normalizeRelativePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function hasUnresolvedTemplateSyntax(value: string): boolean {
  return /\{\{|\}\}/.test(value);
}

async function findSkillTemplates(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...await findSkillTemplates(entryPath));
    } else if (entry.isFile() && entry.name === "SKILL.md.hbs") {
      paths.push(entryPath);
    }
  }

  return paths;
}

function skillFromTemplatePath(templatePath: string): PackagedSkill {
  const id = normalizeRelativePath(relative(packagedSkillDirectory, dirname(templatePath)));
  if (!id || id.startsWith("../") || id.includes("/../") || id === ".") {
    throw new Error(`Invalid packaged skill directory: ${templatePath}`);
  }

  return {
    id,
    sourcePath: templatePath,
    source: `${PACKAGED_SKILLS_SOURCE_DIRECTORY}/${id}/SKILL.md.hbs`,
    destination: `${PROJECT_SKILLS_DIRECTORY}/${id}/SKILL.md`,
  };
}

export async function listPackagedSkills(): Promise<PackagedSkill[]> {
  const templates = await findSkillTemplates(packagedSkillDirectory);
  return templates
    .map(skillFromTemplatePath)
    .sort((left, right) => left.id.localeCompare(right.id));
}

export async function getPackagedSkill(skillId: string): Promise<PackagedSkill> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillId)) {
    throw new Error(`Invalid skill name: ${skillId}`);
  }

  const skill = (await listPackagedSkills()).find((entry) => entry.id === skillId);
  if (!skill) {
    throw new Error(`Unknown packaged skill: ${skillId}`);
  }
  return skill;
}

export async function readPackagedSkillContent(skillId: string): Promise<{
  skill: PackagedSkill;
  content: string;
}> {
  const skill = await getPackagedSkill(skillId);
  const content = await renderTemplateFile(skill.sourcePath, { data: {} });

  if (hasUnresolvedTemplateSyntax(content)) {
    throw new Error(`Packaged skill ${skill.id} rendered with unresolved template syntax; refusing to materialize it.`);
  }

  return { skill, content };
}

async function readExistingSkill(path: string): Promise<string | undefined> {
  try {
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink()) {
      throw new Error(`Refusing to materialize through symbolic link: ${path}`);
    }
    if (!metadata.isFile()) {
      throw new Error(`Skill destination is not a regular file: ${path}`);
    }
    if (metadata.nlink > 1) {
      throw new Error(`Refusing to materialize through hard-linked destination: ${path}`);
    }
    return await readFile(path, "utf8");
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return undefined;
    }
    throw error;
  }
}

async function assertSafeDestinationAncestors(
  rootDirectory: string,
  destinationPath: string,
): Promise<void> {
  const rootPath = resolve(rootDirectory);
  const parentPath = dirname(destinationPath);
  const relativeParent = relative(rootPath, parentPath);
  if (relativeParent.startsWith("..") || relativeParent.includes(`..${sep}`)) {
    throw new Error(`Skill destination escapes the project root: ${destinationPath}`);
  }

  const rootRealPath = await realpath(rootPath);
  let currentPath = rootPath;
  for (const component of relativeParent.split(sep).filter(Boolean)) {
    currentPath = join(currentPath, component);
    try {
      const metadata = await lstat(currentPath);
      if (metadata.isSymbolicLink()) {
        throw new Error(`Refusing to materialize through symbolic-link directory: ${currentPath}`);
      }

      const realPath = await realpath(currentPath);
      if (realPath !== rootRealPath && !realPath.startsWith(`${rootRealPath}${sep}`)) {
        throw new Error(`Skill destination resolves outside the project root: ${currentPath}`);
      }
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        break;
      }
      throw error;
    }
  }
}

function descriptorChildPath(fileDescriptor: number, component: string): string | undefined {
  if (process.platform === "linux" || process.platform === "android") {
    return `/proc/self/fd/${fileDescriptor}/${component}`;
  }
  if (process.platform === "darwin" || process.platform === "freebsd") {
    return `/dev/fd/${fileDescriptor}/${component}`;
  }
  return undefined;
}

async function openDirectoryChild(
  parent: FileHandle,
  component: string,
  directoryFlags: number,
): Promise<FileHandle> {
  const childPath = descriptorChildPath(parent.fd, component);
  if (!childPath) {
    throw new Error("This platform does not expose descriptor-relative directory traversal.");
  }

  try {
    return await open(childPath, directoryFlags);
  } catch (error: unknown) {
    if (
      !(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      )
    ) {
      throw error;
    }
    await mkdir(childPath, { recursive: false });
    return open(childPath, directoryFlags);
  }
}

async function writeOpenFile(
  destinationPath: string,
  content: string,
  status: "create" | "update",
  noFollow: number,
): Promise<void> {
  const flags = constants.O_WRONLY
    | constants.O_CREAT
    | noFollow
    | (status === "create" ? constants.O_EXCL : constants.O_TRUNC);
  const handle = await open(destinationPath, flags, 0o644);
  try {
    await handle.writeFile(content, "utf8");
  } finally {
    await handle.close();
  }
}

async function resolveSafePathBasedDestination(
  projectRoot: string,
  destinationPath: string,
  fileName: string,
): Promise<string> {
  await mkdir(dirname(destinationPath), { recursive: true });
  await assertSafeDestinationAncestors(projectRoot, destinationPath);

  // Anchor later path operations to the canonical parent directory. If a
  // logical ancestor is swapped for a symlink after this check, the write
  // still addresses the already-resolved directory inside the project root.
  const canonicalParent = await realpath(dirname(destinationPath));
  const safeDestination = join(canonicalParent, fileName);
  await assertSafeDestinationAncestors(projectRoot, safeDestination);
  return safeDestination;
}

async function writeDescriptorRelativeFile(
  parent: FileHandle,
  fileName: string,
  content: string,
  status: "create" | "update",
  noFollow: number,
): Promise<void> {
  const destinationPath = descriptorChildPath(parent.fd, fileName);
  if (!destinationPath) {
    throw new Error("This platform does not expose safe descriptor-relative skill materialization.");
  }

  if (status === "create") {
    await writeOpenFile(destinationPath, content, "create", noFollow);
    return;
  }

  const temporaryName = `.${fileName}.${randomUUID()}.tmp`;
  const temporaryPath = descriptorChildPath(parent.fd, temporaryName);
  if (!temporaryPath) {
    throw new Error("This platform does not expose safe descriptor-relative skill materialization.");
  }

  try {
    await writeOpenFile(temporaryPath, content, "create", noFollow);
    // Same-parent rename replaces the final directory entry, so a concurrent
    // hardlink or symlink replacement cannot redirect the write to its target.
    await rename(temporaryPath, destinationPath);
  } finally {
    try {
      await unlink(temporaryPath);
    } catch (error: unknown) {
      if (
        !(
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        )
      ) {
        throw error;
      }
    }
  }
}

async function writeMaterializedSkill(
  rootDirectory: string,
  destination: string,
  content: string,
  status: "create" | "update",
): Promise<void> {
  const noFollow = constants.O_NOFOLLOW ?? 0;
  const directoryFlags = constants.O_RDONLY
    | (constants.O_DIRECTORY ?? 0)
    | noFollow;
  const projectRoot = await realpath(resolve(rootDirectory));
  const destinationPath = join(projectRoot, destination);
  const relativeDestination = relative(projectRoot, destinationPath);
  const components = relativeDestination.split(sep).filter(Boolean);
  const fileName = components.pop();
  if (!fileName || components.length === 0) {
    throw new Error(`Invalid packaged skill destination: ${destination}`);
  }

  if (!descriptorChildPath(0, components[0]!) || noFollow === 0) {
    // Node does not expose descriptor-relative traversal on Windows. The
    // path-based fallback repeats the ancestor and destination checks after
    // creating missing directories so Windows can use the same workflow. An
    // update removes only the final directory entry, then recreates it with
    // CREATE_NEW/O_EXCL so a replacement symlink or hardlink is never opened.
    const safeDestination = await resolveSafePathBasedDestination(
      projectRoot,
      destinationPath,
      fileName,
    );
    await readExistingSkill(safeDestination);
    if (status === "update") {
      try {
        await unlink(safeDestination);
      } catch (error: unknown) {
        if (
          !(
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT"
          )
        ) {
          throw error;
        }
      }
    }
    await writeOpenFile(safeDestination, content, "create", 0);
    return;
  }

  const rootHandle = await open(projectRoot, directoryFlags);
  const handles: FileHandle[] = [rootHandle];
  try {
    let parent = rootHandle;
    for (const component of components) {
      const child = await openDirectoryChild(parent, component, directoryFlags);
      handles.push(child);
      parent = child;
    }

    await writeDescriptorRelativeFile(parent, fileName, content, status, noFollow);
  } finally {
    for (const handle of handles.reverse()) {
      await handle.close();
    }
  }
}

export async function materializePackagedSkill(
  rootDirectory: string,
  skillId: string,
  options: MaterializeSkillOptions = {},
): Promise<MaterializeSkillResult> {
  if (options.force && !options.apply) {
    throw new Error("--force requires --apply; preview never overwrites a project skill.");
  }

  const { skill, content } = await readPackagedSkillContent(skillId);
  const projectRoot = resolve(rootDirectory);
  const destinationPath = join(projectRoot, skill.destination);
  await assertSafeDestinationAncestors(projectRoot, destinationPath);
  const existing = await readExistingSkill(destinationPath);
  const applied = options.apply ?? false;

  let status: SkillMaterializationStatus;
  if (existing === undefined) {
    status = "create";
  } else if (normalizeLineEndings(existing) === normalizeLineEndings(content)) {
    status = "no-op";
  } else if (applied && options.force) {
    status = "update";
  } else {
    status = "customized-conflict";
  }

  const shouldWrite = applied && (status === "create" || status === "update");
  if (shouldWrite) {
    await writeMaterializedSkill(
      projectRoot,
      skill.destination,
      content,
      status === "create" ? "create" : "update",
    );
  }

  return {
    skill,
    status,
    applied,
    written: shouldWrite,
  };
}
