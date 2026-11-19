import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readAgenticConfigFile } from "../config/index.js";
import { resolveContainedWriteBatch, } from "../config/paths.js";
import { styleRulesFor, DEFAULT_AGENT_POLICY, renderAgentExportFiles, renderAgentExportTarget, } from "../exporters/index.js";
function normalizeLineEndings(value) {
    return value.replace(/\r\n/g, "\n");
}
async function readOptionalFile(path) {
    try {
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
async function renderExpectedFiles(rootDirectory, target) {
    const config = await readAgenticConfigFile(rootDirectory);
    const policy = {
        ...DEFAULT_AGENT_POLICY,
        projectName: config.projectName,
        defaultStyle: config.agentStyle,
        styleRules: styleRulesFor(config.agentStyle),
    };
    return target
        ? renderAgentExportTarget(target, policy)
        : renderAgentExportFiles(policy);
}
async function writeExpectedFile(target, content) {
    await mkdir(dirname(target.absolutePath), { recursive: true });
    await writeFile(target.absolutePath, content, "utf8");
}
export async function syncAgentExports(rootDirectory, options = {}) {
    const files = await renderExpectedFiles(rootDirectory, options.target);
    const current = [];
    const missing = [];
    const stale = [];
    const written = [];
    for (const file of files) {
        const actual = await readOptionalFile(join(rootDirectory, file.outputPath));
        if (actual === undefined) {
            missing.push(file.outputPath);
        }
        else if (normalizeLineEndings(actual) !== normalizeLineEndings(file.content)) {
            stale.push(file.outputPath);
        }
        else {
            current.push(file.outputPath);
        }
    }
    if (options.write) {
        const writeSet = files.filter((entry) => (missing.includes(entry.outputPath) || stale.includes(entry.outputPath)));
        const targets = await resolveContainedWriteBatch(rootDirectory, writeSet.map((file) => file.outputPath));
        for (const [index, target] of targets.entries()) {
            await writeExpectedFile(target, writeSet[index].content);
            written.push(target.relativePath);
        }
    }
    return {
        checked: files.map((file) => file.outputPath),
        current,
        missing,
        stale,
        written,
        hasDrift: missing.length > 0 || stale.length > 0,
    };
}
function renderNamedList(label, items) {
    return items.length === 0
        ? [`${label}: none`]
        : [`${label}:`, ...items.map((item) => `- ${item}`)];
}
export function renderSyncSummary(result) {
    return [
        `Checked ${result.checked.length} generated file(s).`,
        `Current: ${result.current.length}`,
        ...renderNamedList("Missing", result.missing),
        ...renderNamedList("Stale", result.stale),
        ...renderNamedList("Written", result.written),
        result.written.length > 0
            ? "Generated files were updated."
            : result.hasDrift
                ? "Generated files are out of sync."
                : "Generated files are in sync.",
        "",
    ].join("\n");
}
