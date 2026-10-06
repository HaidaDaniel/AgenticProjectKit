import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG_PATH, RUNTIME_MANIFEST_ROLES } from "../config/index.js";
import { listAgentExporters } from "../exporters/index.js";
const IGNORED_DIRECTORIES = new Set([
    ".git",
    "node_modules",
    "dist",
    "build",
    ".next",
    ".turbo",
    ".cache",
]);
const MAX_RUNTIME_DISCOVERY_DIRECTORIES = 256;
const MAX_RUNTIME_DISCOVERY_DEPTH = 3;
const APK_PACKAGE_NAMES = new Set(["agentic-project-kit"]);
const NODE_TOOLING_PACKAGES = new Set([
    "@types/node",
    "c8",
    "eslint",
    "handlebars",
    "husky",
    "lint-staged",
    "prettier",
    "tsx",
    "typescript",
    "typescript-eslint",
]);
const NODE_APPLICATION_FRAMEWORKS = new Set([
    "@angular/core",
    "express",
    "fastify",
    "next",
    "react",
    "solid-js",
    "svelte",
    "vite",
    "vue",
]);
const REQUIRED_KIT_DOCS = [
    "AGENTS.md",
    "docs/project.md",
    "docs/scope.md",
    "docs/architecture.md",
    "docs/task-system.md",
    "docs/context-system.md",
    "docs/decisions.md",
    "docs/progress.md",
];
const CI_DIRECTORY_MARKERS = [".github/workflows", ".buildkite"];
const CI_FILE_MARKERS = [
    ".gitlab-ci.yml",
    ".gitlab-ci.yaml",
    ".circleci/config.yml",
    "azure-pipelines.yml",
    "bitbucket-pipelines.yml",
    "buildkite.yml",
    ".drone.yml",
    "Jenkinsfile",
];
async function fileExists(path) {
    try {
        return (await stat(path)).isFile();
    }
    catch (error) {
        if (error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT") {
            return false;
        }
        throw error;
    }
}
async function directoryHasEntries(path) {
    try {
        if (!(await stat(path)).isDirectory())
            return false;
        return (await readdir(path)).length > 0;
    }
    catch (error) {
        if (error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT") {
            return false;
        }
        throw error;
    }
}
async function hasCiConfiguration(rootDirectory) {
    for (const marker of CI_FILE_MARKERS) {
        if (await fileExists(join(rootDirectory, marker)))
            return true;
    }
    for (const marker of CI_DIRECTORY_MARKERS) {
        if (await directoryHasEntries(join(rootDirectory, marker)))
            return true;
    }
    return false;
}
async function listMarkdownFiles(rootDirectory, directory) {
    try {
        return (await readdir(join(rootDirectory, directory)))
            .filter((entry) => entry.endsWith(".md"))
            .map((entry) => `${directory}/${entry}`)
            .sort();
    }
    catch (error) {
        if (error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT") {
            return [];
        }
        throw error;
    }
}
async function scanFileSet(rootDirectory, expected) {
    const present = [];
    const missing = [];
    for (const path of expected) {
        if (await fileExists(join(rootDirectory, path))) {
            present.push(path);
        }
        else {
            missing.push(path);
        }
    }
    return {
        expected: [...expected],
        present,
        missing,
    };
}
function packageStack(packageJson) {
    const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
    };
    const stack = ["Node.js"];
    if ("typescript" in dependencies) {
        stack.push("TypeScript");
    }
    if ("react" in dependencies) {
        stack.push("React");
    }
    if ("next" in dependencies) {
        stack.push("Next.js");
    }
    if ("vite" in dependencies) {
        stack.push("Vite");
    }
    return stack;
}
async function detectPackageStack(rootDirectory) {
    const packagePath = join(rootDirectory, "package.json");
    if (!(await fileExists(packagePath))) {
        return [];
    }
    return packageStack(JSON.parse(await readFile(packagePath, "utf8")));
}
const PYTHON_MARKER_FILES = [
    "pyproject.toml",
    "requirements.txt",
    "uv.lock",
    "setup.py",
    "setup.cfg",
];
const PYTHON_REQUIREMENTS_PATTERN = /^requirements-.*\.(?:txt|lock)$/;
/**
 * Cross-stack primary-runtime markers. Bounded to Python and Go: these are
 * evidenced by canonical project markers, not by arbitrary source-file
 * extensions, and never suppress an evidenced Node/pnpm stack.
 */
function hasPythonMarkers(topLevelFiles) {
    return topLevelFiles.some((file) => (PYTHON_MARKER_FILES.includes(file)
        || PYTHON_REQUIREMENTS_PATTERN.test(file)));
}
function hasGoMarkers(topLevelFiles) {
    return topLevelFiles.includes("go.mod");
}
async function readJsonFile(path) {
    if (!(await fileExists(path))) {
        return undefined;
    }
    return JSON.parse(await readFile(path, "utf8"));
}
async function discoverRuntimeCandidates(rootDirectory) {
    const candidates = [];
    const queue = [{ absolutePath: rootDirectory, relativePath: ".", depth: 0 }];
    let inspectedDirectories = 0;
    let discoveryLimited = false;
    while (queue.length > 0 && inspectedDirectories < MAX_RUNTIME_DISCOVERY_DIRECTORIES) {
        const current = queue.shift();
        if (!current)
            break;
        inspectedDirectories += 1;
        const entries = (await readdir(current.absolutePath, { withFileTypes: true }))
            .sort((left, right) => left.name.localeCompare(right.name));
        const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
        const packageJson = files.includes("package.json")
            ? await readJsonFile(join(current.absolutePath, "package.json"))
            : undefined;
        if (packageJson !== undefined
            || hasPythonMarkers(files)
            || hasGoMarkers(files)) {
            candidates.push({
                path: current.relativePath,
                files,
                ...(packageJson === undefined ? {} : { packageJson }),
            });
        }
        const childDirectories = entries.filter((entry) => (entry.isDirectory()
            && !IGNORED_DIRECTORIES.has(entry.name)
            && !entry.name.startsWith(".")));
        if (current.depth >= MAX_RUNTIME_DISCOVERY_DEPTH) {
            if (childDirectories.length > 0)
                discoveryLimited = true;
            continue;
        }
        for (const entry of childDirectories) {
            queue.push({
                absolutePath: join(current.absolutePath, entry.name),
                relativePath: current.relativePath === "." ? entry.name : `${current.relativePath}/${entry.name}`,
                depth: current.depth + 1,
            });
        }
    }
    return {
        candidates,
        discoveryLimited: discoveryLimited || queue.length > 0,
    };
}
function dependencyNames(packageJson) {
    return [
        ...Object.keys(packageJson.dependencies ?? {}),
        ...Object.keys(packageJson.devDependencies ?? {}),
    ];
}
function packageHasApkDependency(packageJson) {
    return dependencyNames(packageJson).some((name) => APK_PACKAGE_NAMES.has(name));
}
function nodeApplicationEvidence(packageJson) {
    const evidence = [];
    const dependencyNamesSet = new Set(dependencyNames(packageJson));
    const productionDependencies = Object.keys(packageJson.dependencies ?? {});
    const framework = [...dependencyNamesSet].find((name) => NODE_APPLICATION_FRAMEWORKS.has(name));
    if (framework)
        evidence.push(`package.json dependency ${framework}`);
    if (productionDependencies.some((name) => !NODE_TOOLING_PACKAGES.has(name) && !APK_PACKAGE_NAMES.has(name))) {
        evidence.push("package.json production dependency");
    }
    if (["main", "module", "exports", "bin"].some((field) => packageJson[field] !== undefined)) {
        evidence.push("package.json runtime entrypoint");
    }
    const runtimeScript = Object.entries(packageJson.scripts ?? {}).find(([script, command]) => (/^(?:start|dev|serve|preview)$/.test(script)
        && typeof command === "string"
        && /\b(?:node|tsx|ts-node|vite|next|react-scripts|webpack|rollup|parcel|astro|nuxt|svelte-kit)\b/i.test(command)));
    if (runtimeScript)
        evidence.push(`package.json ${runtimeScript[0]} script`);
    return evidence;
}
function packageManifestRole(candidate, override) {
    if (!candidate.packageJson)
        return { role: "ambiguous", evidence: [] };
    const packageJson = candidate.packageJson;
    const evidence = nodeApplicationEvidence(packageJson);
    if (candidate.path === "." && override) {
        const role = override === "tooling" && evidence.length > 0 ? "mixed" : override;
        return {
            role,
            evidence: [...evidence, `runtimeManifestRole=${override}`],
        };
    }
    if (evidence.length > 0)
        return { role: "application", evidence };
    if (packageHasApkDependency(packageJson)) {
        return { role: "tooling", evidence: ["package.json APK dependency"] };
    }
    return { role: "ambiguous", evidence: ["package.json has no bounded runtime ownership evidence"] };
}
function addRuntimeComponent(components, component) {
    if (!components.some((entry) => (entry.path === component.path
        && entry.runtime === component.runtime
        && entry.role === component.role))) {
        components.push(component);
    }
}
function scanRuntimeEvidence(candidates, packageManager, rootManifestRole, discoveryLimited) {
    const components = [];
    const toolingStack = new Set();
    const applicationRuntimes = new Set();
    const ambiguousRuntimes = new Set();
    for (const candidate of candidates) {
        if (hasPythonMarkers(candidate.files)) {
            applicationRuntimes.add("Python");
            addRuntimeComponent(components, {
                path: candidate.path,
                runtime: "Python",
                role: "application",
                evidence: candidate.files.filter((file) => (PYTHON_MARKER_FILES.includes(file)
                    || PYTHON_REQUIREMENTS_PATTERN.test(file))).sort(),
            });
        }
        if (hasGoMarkers(candidate.files)) {
            applicationRuntimes.add("Go");
            addRuntimeComponent(components, {
                path: candidate.path,
                runtime: "Go",
                role: "application",
                evidence: ["go.mod"],
            });
        }
        if (!candidate.packageJson)
            continue;
        const packageRole = packageManifestRole(candidate, rootManifestRole);
        const packageStackValues = packageStack(candidate.packageJson);
        if (packageRole.role === "application" || packageRole.role === "mixed") {
            applicationRuntimes.add("Node.js");
            addRuntimeComponent(components, {
                path: candidate.path,
                runtime: "Node.js",
                role: packageRole.role,
                evidence: packageRole.evidence,
            });
        }
        if (packageRole.role === "tooling" || packageRole.role === "mixed") {
            packageStackValues.forEach((value) => toolingStack.add(value));
            if (packageHasApkDependency(candidate.packageJson))
                toolingStack.add("APK");
            addRuntimeComponent(components, {
                path: candidate.path,
                runtime: "Node.js",
                role: packageRole.role,
                evidence: packageRole.evidence,
            });
        }
        if (packageRole.role === "ambiguous") {
            ambiguousRuntimes.add("Node.js");
            addRuntimeComponent(components, {
                path: candidate.path,
                runtime: "Node.js",
                role: "ambiguous",
                evidence: packageRole.evidence,
            });
        }
    }
    if (packageManager)
        toolingStack.add(packageManager);
    if (candidates.some((candidate) => candidate.packageJson && packageHasApkDependency(candidate.packageJson))) {
        toolingStack.add("APK");
        toolingStack.add("Node.js");
    }
    return {
        applicationRuntimes: [...applicationRuntimes].sort(),
        toolingStack: [...toolingStack].sort(),
        ambiguousRuntimes: [...ambiguousRuntimes].sort(),
        components: components.sort((left, right) => (left.path.localeCompare(right.path)
            || left.runtime.localeCompare(right.runtime)
            || left.role.localeCompare(right.role))),
        discoveryLimited,
        diagnostics: discoveryLimited
            ? ["Runtime component discovery reached its bounded directory limit; unobserved components remain unknown."]
            : [],
    };
}
async function readRuntimeManifestRole(rootDirectory) {
    try {
        const config = await readJsonFile(join(rootDirectory, CONFIG_PATH));
        const value = config?.runtimeManifestRole;
        return typeof value === "string" && RUNTIME_MANIFEST_ROLES.includes(value)
            ? value
            : undefined;
    }
    catch {
        // audit/adopt own full config validation; scanner semantics remain available
        // for invalid config diagnostics instead of masking the original finding.
        return undefined;
    }
}
async function scanReadiness(rootDirectory, topLevelDirectories, topLevelFiles) {
    const packageJson = await readJsonFile(join(rootDirectory, "package.json"));
    const scripts = packageJson?.scripts && typeof packageJson.scripts === "object"
        ? Object.keys(packageJson.scripts).sort()
        : [];
    const lockfiles = [
        "pnpm-lock.yaml",
        "package-lock.json",
        "yarn.lock",
        "bun.lockb",
    ].filter((file) => topLevelFiles.includes(file));
    const packageManager = topLevelFiles.includes("pnpm-lock.yaml") ? "pnpm"
        : topLevelFiles.includes("package-lock.json") ? "npm"
            : topLevelFiles.includes("yarn.lock") ? "yarn"
                : topLevelFiles.includes("bun.lockb") ? "bun"
                    : undefined;
    const tsconfig = await readJsonFile(join(rootDirectory, "tsconfig.json"));
    const compilerOptions = tsconfig?.compilerOptions && typeof tsconfig.compilerOptions === "object"
        ? tsconfig.compilerOptions
        : undefined;
    return {
        packageManager,
        packageScripts: scripts,
        lockfiles,
        hasCi: await hasCiConfiguration(rootDirectory),
        hasEnvExample: topLevelFiles.includes(".env.example"),
        hasDockerfile: topLevelFiles.includes("Dockerfile"),
        hasDockerCompose: topLevelFiles.includes("docker-compose.yml") || topLevelFiles.includes("docker-compose.yaml"),
        hasReadme: topLevelFiles.some((file) => /^readme\.md$/i.test(file)),
        hasLicense: topLevelFiles.some((file) => /^licen[sc]e(\.md|\.txt)?$/i.test(file)),
        testDirectories: topLevelDirectories.filter((directory) => ["test", "tests", "__tests__"].includes(directory)),
        generatedDirectories: topLevelDirectories.filter((directory) => ["dist", "build", ".next", "coverage"].includes(directory)),
        monorepo: topLevelFiles.includes("pnpm-workspace.yaml") || Boolean(packageJson?.workspaces),
        tsStrict: compilerOptions ? compilerOptions.strict === true : undefined,
    };
}
export async function scanRepository(rootDirectory) {
    const entries = await readdir(rootDirectory, { withFileTypes: true });
    const allTopLevelDirectories = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    const topLevelDirectories = allTopLevelDirectories
        .filter((name) => !IGNORED_DIRECTORIES.has(name))
        .sort();
    const topLevelFiles = entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .sort();
    const detectedStack = new Set(await detectPackageStack(rootDirectory));
    if (await fileExists(join(rootDirectory, "tsconfig.json"))) {
        detectedStack.add("TypeScript");
    }
    if (await fileExists(join(rootDirectory, "pnpm-lock.yaml"))) {
        detectedStack.add("pnpm");
    }
    const runtimeManifestRole = await readRuntimeManifestRole(rootDirectory);
    const runtimeDiscovery = await discoverRuntimeCandidates(rootDirectory);
    for (const candidate of runtimeDiscovery.candidates) {
        if (candidate.packageJson) {
            packageStack(candidate.packageJson).forEach((value) => detectedStack.add(value));
        }
        if (hasPythonMarkers(candidate.files))
            detectedStack.add("Python");
        if (hasGoMarkers(candidate.files))
            detectedStack.add("Go");
    }
    const runtime = scanRuntimeEvidence(runtimeDiscovery.candidates, topLevelFiles.includes("pnpm-lock.yaml") ? "pnpm" : undefined, runtimeManifestRole, runtimeDiscovery.discoveryLimited);
    const agentExportPaths = listAgentExporters().map((exporter) => exporter.outputPath);
    return {
        rootName: rootDirectory.split(/[\\/]/).filter(Boolean).at(-1) ?? rootDirectory,
        topLevelDirectories,
        topLevelFiles,
        detectedStack: [...detectedStack].sort(),
        runtime,
        readiness: await scanReadiness(rootDirectory, allTopLevelDirectories, topLevelFiles),
        kitDocs: await scanFileSet(rootDirectory, REQUIRED_KIT_DOCS),
        agentExports: await scanFileSet(rootDirectory, agentExportPaths),
        hasAgenticConfig: await fileExists(join(rootDirectory, CONFIG_PATH)),
        taskFiles: await listMarkdownFiles(rootDirectory, ".tasks"),
    };
}
