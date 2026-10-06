import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
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
export async function materializePackagedSkill(rootDirectory, skillId, options = {}) {
    if (options.force && !options.apply) {
        throw new Error("--force requires --apply; preview never overwrites a project skill.");
    }
    const { skill, content } = await readPackagedSkillContent(skillId);
    const destinationPath = join(rootDirectory, skill.destination);
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
        await mkdir(dirname(destinationPath), { recursive: true });
        await writeFile(destinationPath, content, "utf8");
    }
    return {
        skill,
        status,
        applied,
        written: shouldWrite,
    };
}
