import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
export const PACKAGED_DIST_CHECK_ID = "build-current";
const DIST_STATUS_CHECK = 'test -z "$(git status --porcelain --untracked-files=all --ignored=matching -- dist)"';
export const PACKAGED_DIST_BUILD_COMMAND = "pnpm build";
export const PACKAGED_DIST_CHECK_COMMAND = packagedDistCheckCommand(PACKAGED_DIST_BUILD_COMMAND);
function normalizeRepoPath(value) {
    return value.replace(/\\/g, "/").replace(/^\.\//, "");
}
function pathPatternRegex(pattern) {
    let source = "";
    const normalized = normalizeRepoPath(pattern);
    for (let index = 0; index < normalized.length; index += 1) {
        const char = normalized[index];
        if (char === "*" && normalized[index + 1] === "*") {
            source += ".*";
            index += 1;
        }
        else if (char === "*") {
            source += "[^/]*";
        }
        else {
            source += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
        }
    }
    return new RegExp(`^${source}$`);
}
export function taskPathPatternMatches(pattern, path) {
    return pathPatternRegex(pattern).test(normalizeRepoPath(path));
}
/** Conservatively detect forbidden globs that can cover any package output below dist/. */
export function taskPathPatternMayMatchDistOutput(pattern) {
    const normalized = normalizeRepoPath(pattern);
    const separator = normalized.indexOf("/");
    if (separator < 0)
        return false;
    return pathPatternRegex(normalized.slice(0, separator)).test("dist");
}
export function packagedDistBuildCommand(manager) {
    if (manager === "npm")
        return "npm run build";
    if (manager === "bun")
        return "bun run build";
    return `${manager} build`;
}
export function packagedDistCheckCommand(buildCommand) {
    return `rm -rf dist && ${buildCommand} && ${DIST_STATUS_CHECK}`;
}
/** The repository packages compiled TypeScript and Handlebars assets copied from core/templates. */
export function isPackagedInputPath(path) {
    const normalized = normalizeRepoPath(path);
    if (!normalized.startsWith("src/"))
        return false;
    if (normalized.endsWith(".test.ts"))
        return false;
    return normalized.endsWith(".ts")
        || (normalized.startsWith("src/core/templates/") && normalized.endsWith(".hbs"));
}
/** Conservatively match task globs that may include a compiled source or copied asset. */
export function mayIncludePackagedSource(pattern) {
    const normalized = normalizeRepoPath(pattern);
    if (!normalized.startsWith("src/") || normalized.endsWith(".test.ts"))
        return false;
    const leaf = normalized.slice(normalized.lastIndexOf("/") + 1);
    const extension = leaf.match(/\.([^./*]+)$/)?.[1];
    if (extension === undefined || extension === "ts")
        return true;
    if (extension !== "hbs")
        return false;
    if (normalized.startsWith("src/core/templates/"))
        return true;
    // Broad globs may cover the supported copy root even when the root is wildcarded.
    return normalized.startsWith("src/**")
        || normalized.startsWith("src/*/**")
        || normalized.startsWith("src/*/templates/")
        || normalized.startsWith("src/core/**")
        || normalized.startsWith("src/core/*/");
}
async function packageManagerFromManifest(rootDirectory, declaredManager) {
    const supported = ["pnpm", "npm", "yarn", "bun"];
    if (typeof declaredManager === "string") {
        const manager = declaredManager.split("@")[0];
        return supported.includes(manager) ? manager : undefined;
    }
    const lockfiles = [
        ["pnpm-lock.yaml", "pnpm"],
        ["package-lock.json", "npm"],
        ["yarn.lock", "yarn"],
        ["bun.lock", "bun"],
        ["bun.lockb", "bun"],
    ];
    const present = [];
    for (const [file, manager] of lockfiles) {
        try {
            await access(join(rootDirectory, file));
            if (!present.includes(manager))
                present.push(manager);
        }
        catch {
            // An absent lockfile is not a package-manager declaration.
        }
    }
    return present.length === 1 ? present[0] : undefined;
}
function packagePathMayMatchDist(path) {
    const normalized = normalizeRepoPath(path).replace(/\/+$/, "");
    return normalized === "dist" || normalized.startsWith("dist/");
}
function packageFilesPatternMayIncludeDist(pattern) {
    const normalized = normalizeRepoPath(pattern);
    if (packagePathMayMatchDist(normalized))
        return true;
    const firstSegment = normalized.split("/")[0];
    if (!firstSegment)
        return true;
    if (firstSegment.includes("{") || firstSegment.includes("}"))
        return true;
    let expression = "^";
    for (let index = 0; index < firstSegment.length; index += 1) {
        const char = firstSegment[index];
        if (char === "*") {
            expression += "[^/]*";
        }
        else if (char === "?") {
            expression += "[^/]";
        }
        else if (char === "[") {
            const close = firstSegment.indexOf("]", index + 1);
            if (close < 0)
                return true;
            expression += firstSegment.slice(index, close + 1);
            index = close;
        }
        else {
            expression += char.replace(/[|\\()[\]^$+?.]/g, "\\$&");
        }
    }
    try {
        return new RegExp(`${expression}$`).test("dist");
    }
    catch {
        return true;
    }
}
function packageBinPaths(value) {
    if (value === undefined)
        return [];
    if (typeof value === "string")
        return [value];
    if (!value || typeof value !== "object" || Array.isArray(value))
        return undefined;
    const paths = [];
    for (const entry of Object.values(value)) {
        if (typeof entry !== "string")
            return undefined;
        paths.push(entry);
    }
    return paths;
}
async function packageMayShipDist(rootDirectory, record) {
    const entrypointPaths = [];
    if (record.main !== undefined) {
        if (typeof record.main !== "string")
            return true;
        entrypointPaths.push(record.main);
    }
    const binPaths = packageBinPaths(record.bin);
    if (!binPaths)
        return true;
    entrypointPaths.push(...binPaths);
    if (record.directories !== undefined) {
        if (!record.directories || typeof record.directories !== "object" || Array.isArray(record.directories))
            return true;
        const binDirectory = record.directories.bin;
        if (binDirectory !== undefined) {
            if (typeof binDirectory !== "string")
                return true;
            entrypointPaths.push(binDirectory);
        }
    }
    if (entrypointPaths.some(packagePathMayMatchDist))
        return true;
    if (record.files === undefined) {
        // npm's omitted files field defaults to including the package tree.
        try {
            await access(join(rootDirectory, "dist"));
            return true;
        }
        catch {
            return false;
        }
    }
    if (!Array.isArray(record.files))
        return true;
    if (record.files.some((entry) => typeof entry !== "string"))
        return true;
    return record.files.some(packageFilesPatternMayIncludeDist);
}
export async function repositoryPackagedDistContract(rootDirectory) {
    let rawManifest;
    try {
        rawManifest = await readFile(join(rootDirectory, "package.json"), "utf8");
    }
    catch (error) {
        if (error.code === "ENOENT") {
            return { shipsCommittedDist: false, buildScriptAvailable: false };
        }
        return { shipsCommittedDist: true, buildScriptAvailable: false };
    }
    let manifest;
    try {
        manifest = JSON.parse(rawManifest);
    }
    catch {
        return { shipsCommittedDist: true, buildScriptAvailable: false };
    }
    try {
        if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
            return { shipsCommittedDist: true, buildScriptAvailable: false };
        }
        const record = manifest;
        const shipsCommittedDist = await packageMayShipDist(rootDirectory, record);
        if (!shipsCommittedDist)
            return { shipsCommittedDist: false, buildScriptAvailable: false };
        const manager = await packageManagerFromManifest(rootDirectory, record.packageManager);
        const buildCommand = manager ? packagedDistBuildCommand(manager) : undefined;
        const buildScriptAvailable = record.scripts !== null
            && typeof record.scripts === "object"
            && !Array.isArray(record.scripts)
            && typeof record.scripts.build === "string"
            && record.scripts.build.trim().length > 0;
        return {
            shipsCommittedDist: true,
            buildScriptAvailable,
            ...(buildCommand ? { buildCommand, checkCommand: packagedDistCheckCommand(buildCommand) } : {}),
        };
    }
    catch {
        return { shipsCommittedDist: true, buildScriptAvailable: false };
    }
}
export async function repositoryShipsCommittedDist(rootDirectory) {
    return (await repositoryPackagedDistContract(rootDirectory)).shipsCommittedDist;
}
export function taskHasRequiredPackagedDistCheck(task, expectedCommand = PACKAGED_DIST_CHECK_COMMAND) {
    const checks = task.verification ?? task.verificationCommands.map((command, index) => ({
        id: `check-${index + 1}`,
        type: "automated",
        required: true,
        environment: "local",
        profile: "deterministic",
        command,
    }));
    return checks.some((check) => (check.id === PACKAGED_DIST_CHECK_ID
        && check.required
        && check.type === "automated"
        && check.environment === "local"
        && check.profile === "deterministic"
        && check.command === expectedCommand));
}
export function packagedDistTaskContractBlockers(task, options) {
    if (task.state !== "doing" && task.state !== "review")
        return [];
    if (!task.allowedFiles.some(mayIncludePackagedSource))
        return [];
    const blockers = [];
    const forbiddenDist = task.forbiddenFiles.some(taskPathPatternMayMatchDistOutput);
    if (!task.allowedFiles.includes("dist/**") || forbiddenDist) {
        blockers.push("packaged-source: Allow dist/** and remove any matching dist prohibition so generated package output can be committed.");
    }
    if (options && !options.buildScriptAvailable) {
        blockers.push("packaged-source: The package still ships dist but has no usable scripts.build; add a build script before this task can complete.");
    }
    const expectedCommand = options?.checkCommand ?? (options ? undefined : PACKAGED_DIST_CHECK_COMMAND);
    if (!expectedCommand) {
        blockers.push("packaged-source: Declare one supported package manager so the required build-current command can be derived.");
    }
    else if (!taskHasRequiredPackagedDistCheck(task, expectedCommand)) {
        blockers.push(`packaged-source: Require check ${PACKAGED_DIST_CHECK_ID} with command ${expectedCommand} to prove generated dist is current.`);
    }
    return blockers;
}
export function packagedInputPathsChanged(paths) {
    return paths.some(isPackagedInputPath);
}
