import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir, realpath, rename, unlink, } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { renderTemplateFile } from "../templates/index.js";
export const PROJECT_SKILLS_DIRECTORY = ".agents/skills";
export const PACKAGED_SKILLS_SOURCE_DIRECTORY = "core/templates/skills";
const packagedSkillDirectory = join(dirname(fileURLToPath(import.meta.url)), "..", "templates", "skills");
function normalizeLineEndings(value) {
    return value.replace(/\r\n?/g, "\n");
}
function normalizeRelativePath(value) {
    return value.replaceAll("\\", "/");
}
function hasUnresolvedTemplateSyntax(value) {
    return /\{\{|\}\}/.test(value);
}
async function findSkillTemplates(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const paths = [];
    for (const entry of entries) {
        const entryPath = join(directory, entry.name);
        if (entry.isDirectory()) {
            paths.push(...await findSkillTemplates(entryPath));
        }
        else if (entry.isFile() && entry.name === "SKILL.md.hbs") {
            paths.push(entryPath);
        }
    }
    return paths;
}
function skillFromTemplatePath(templatePath) {
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
export async function listPackagedSkills() {
    const templates = await findSkillTemplates(packagedSkillDirectory);
    return templates
        .map(skillFromTemplatePath)
        .sort((left, right) => left.id.localeCompare(right.id));
}
export async function getPackagedSkill(skillId) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillId)) {
        throw new Error(`Invalid skill name: ${skillId}`);
    }
    const skill = (await listPackagedSkills()).find((entry) => entry.id === skillId);
    if (!skill) {
        throw new Error(`Unknown packaged skill: ${skillId}`);
    }
    return skill;
}
export async function readPackagedSkillContent(skillId) {
    const skill = await getPackagedSkill(skillId);
    const content = await renderTemplateFile(skill.sourcePath, { data: {} });
    if (hasUnresolvedTemplateSyntax(content)) {
        throw new Error(`Packaged skill ${skill.id} rendered with unresolved template syntax; refusing to materialize it.`);
    }
    return { skill, content };
}
async function readExistingSkill(path) {
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
    }
    catch (error) {
        if (error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT") {
            return undefined;
        }
        throw error;
    }
}
async function assertSafeDestinationAncestors(rootDirectory, destinationPath, platform = process.platform) {
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
            const logicalPath = resolve(currentPath);
            const normalizedRealPath = platform === "win32" ? realPath.toLowerCase() : realPath;
            const normalizedLogicalPath = platform === "win32" ? logicalPath.toLowerCase() : logicalPath;
            if (normalizedRealPath !== normalizedLogicalPath) {
                throw new Error(`Refusing to materialize through redirected destination ancestor: ${currentPath}`);
            }
        }
        catch (error) {
            if (error &&
                typeof error === "object" &&
                "code" in error &&
                error.code === "ENOENT") {
                break;
            }
            throw error;
        }
    }
}
function descriptorChildPath(platform, fileDescriptor, component) {
    if (platform === "linux" || platform === "android") {
        return `/proc/self/fd/${fileDescriptor}/${component}`;
    }
    if (platform === "darwin" || platform === "freebsd") {
        return `/dev/fd/${fileDescriptor}/${component}`;
    }
    return undefined;
}
async function openDirectoryChild(platform, parent, component, directoryFlags) {
    const childPath = descriptorChildPath(platform, parent.fd, component);
    if (!childPath) {
        throw new Error("This platform does not expose descriptor-relative directory traversal.");
    }
    try {
        return await open(childPath, directoryFlags);
    }
    catch (error) {
        if (!(error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT")) {
            throw error;
        }
        await mkdir(childPath, { recursive: false });
        return open(childPath, directoryFlags);
    }
}
async function writeOpenFile(destinationPath, content, status, noFollow) {
    const flags = constants.O_WRONLY
        | constants.O_CREAT
        | noFollow
        | (status === "create" ? constants.O_EXCL : constants.O_TRUNC);
    const handle = await open(destinationPath, flags, 0o644);
    try {
        await handle.writeFile(content, "utf8");
    }
    finally {
        await handle.close();
    }
}
async function writeDescriptorRelativeFile(platform, parent, fileName, content, status, noFollow, renameFile) {
    const destinationPath = descriptorChildPath(platform, parent.fd, fileName);
    if (!destinationPath) {
        throw new Error("This platform does not expose safe descriptor-relative skill materialization.");
    }
    if (status === "create") {
        await writeOpenFile(destinationPath, content, "create", noFollow);
        return;
    }
    const temporaryName = `.${fileName}.${randomUUID()}.tmp`;
    const temporaryPath = descriptorChildPath(platform, parent.fd, temporaryName);
    if (!temporaryPath) {
        throw new Error("This platform does not expose safe descriptor-relative skill materialization.");
    }
    try {
        await writeOpenFile(temporaryPath, content, "create", noFollow);
        await renameFile(temporaryPath, destinationPath);
    }
    finally {
        try {
            await unlink(temporaryPath);
        }
        catch (error) {
            if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
                throw error;
            }
        }
    }
}
async function resolveSafePathBasedDestination(projectRoot, destinationPath, fileName, platform) {
    await mkdir(dirname(destinationPath), { recursive: true });
    await assertSafeDestinationAncestors(projectRoot, destinationPath, platform);
    const canonicalParent = await realpath(dirname(destinationPath));
    const canonicalRoot = await realpath(projectRoot);
    const normalizedRoot = platform === "win32" ? canonicalRoot.toLowerCase() : canonicalRoot;
    const normalizedParent = platform === "win32" ? canonicalParent.toLowerCase() : canonicalParent;
    if (normalizedParent !== normalizedRoot && !normalizedParent.startsWith(`${normalizedRoot}${sep}`)) {
        throw new Error(`Skill destination resolves outside the project root: ${destinationPath}`);
    }
    const safeDestination = join(canonicalParent, fileName);
    await assertSafeDestinationAncestors(projectRoot, safeDestination, platform);
    return safeDestination;
}
async function writePathBasedFile(projectRoot, destinationPath, fileName, content, status, platform, renameFile) {
    // This fallback is for platforms where Node core has no openat-like API.
    // The parent is canonicalized immediately before mutation, but a hostile
    // concurrent namespace replacement cannot be ruled out by these path APIs.
    const safeDestination = await resolveSafePathBasedDestination(projectRoot, destinationPath, fileName, platform);
    if (status === "create") {
        await writeOpenFile(safeDestination, content, "create", 0);
        return;
    }
    const canonicalParent = dirname(safeDestination);
    await assertSafeDestinationAncestors(projectRoot, safeDestination, platform);
    const temporaryPath = join(canonicalParent, `.${fileName}.${randomUUID()}.tmp`);
    try {
        await writeOpenFile(temporaryPath, content, "create", 0);
        try {
            await renameFile(temporaryPath, safeDestination);
        }
        catch (error) {
            const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
            if (code !== "EEXIST" && code !== "EPERM" && code !== "EACCES" && code !== "ENOTEMPTY")
                throw error;
            await assertSafeDestinationAncestors(projectRoot, safeDestination, platform);
            const existing = await readExistingSkill(safeDestination);
            if (existing === undefined) {
                await renameFile(temporaryPath, safeDestination);
            }
            else {
                const backupPath = join(canonicalParent, `.${fileName}.${randomUUID()}.bak`);
                await renameFile(safeDestination, backupPath);
                try {
                    await renameFile(temporaryPath, safeDestination);
                }
                catch (replacementError) {
                    try {
                        await unlink(safeDestination);
                    }
                    catch (cleanupError) {
                        if (!(cleanupError && typeof cleanupError === "object" && "code" in cleanupError && cleanupError.code === "ENOENT")) {
                            throw new Error(`Skill replacement failed and the destination could not be restored from ${backupPath}.`, { cause: replacementError });
                        }
                    }
                    try {
                        await renameFile(backupPath, safeDestination);
                    }
                    catch (restoreError) {
                        throw new Error(`Skill replacement failed and the destination could not be restored from ${backupPath}.`, { cause: restoreError });
                    }
                    throw replacementError;
                }
                await unlink(backupPath);
            }
        }
    }
    finally {
        try {
            await unlink(temporaryPath);
        }
        catch (error) {
            if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
                throw error;
            }
        }
    }
}
async function writeMaterializedSkill(rootDirectory, destination, content, status, platform, renameFile) {
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
    if (!descriptorChildPath(platform, 0, components[0]) || noFollow === 0) {
        await writePathBasedFile(projectRoot, destinationPath, fileName, content, status, platform, renameFile);
        return;
    }
    const rootHandle = await open(projectRoot, directoryFlags);
    const handles = [rootHandle];
    try {
        let parent = rootHandle;
        for (const component of components) {
            const child = await openDirectoryChild(platform, parent, component, directoryFlags);
            handles.push(child);
            parent = child;
        }
        await writeDescriptorRelativeFile(platform, parent, fileName, content, status, noFollow, renameFile);
    }
    finally {
        for (const handle of handles.reverse()) {
            await handle.close();
        }
    }
}
export async function materializePackagedSkill(rootDirectory, skillId, options = {}) {
    if (options.force && !options.apply) {
        throw new Error("--force requires --apply; preview never overwrites a project skill.");
    }
    const { skill, content } = await readPackagedSkillContent(skillId);
    const platform = options.platform ?? process.platform;
    const renameFile = options.renameFile ?? rename;
    const projectRoot = resolve(rootDirectory);
    const destinationPath = join(projectRoot, skill.destination);
    await assertSafeDestinationAncestors(projectRoot, destinationPath, platform);
    const existing = await readExistingSkill(destinationPath);
    const applied = options.apply ?? false;
    let status;
    if (existing === undefined) {
        status = "create";
    }
    else if (normalizeLineEndings(existing) === normalizeLineEndings(content)) {
        status = "no-op";
    }
    else if (applied && options.force) {
        status = "update";
    }
    else {
        status = "customized-conflict";
    }
    const shouldWrite = applied && (status === "create" || status === "update");
    if (shouldWrite) {
        await writeMaterializedSkill(projectRoot, skill.destination, content, status === "create" ? "create" : "update", platform, renameFile);
    }
    return {
        skill,
        status,
        applied,
        written: shouldWrite,
    };
}
