import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderTemplateFile } from "../templates/index.js";
export const AGENT_EXPORTER_IDS = [
    "agents",
    "claude",
    "gemini",
];
export const AGENT_EXPORT_TARGETS = [
    "agents",
    "claude",
    "codex",
    "gemini",
    "opencode",
    "cursor",
];
export const LEGACY_AGENT_EXPORT_STATUSES = ["generated", "customized"];
const exporterDirectory = dirname(fileURLToPath(import.meta.url));
const sourceDirectory = dirname(exporterDirectory);
const templateDirectory = join(sourceDirectory, "templates", "exporters");
const EXPORTERS = [
    {
        id: "agents",
        outputPath: "AGENTS.md",
        templatePath: join(templateDirectory, "agents.md.hbs"),
    },
    {
        id: "claude",
        outputPath: "CLAUDE.md",
        templatePath: join(templateDirectory, "claude.md.hbs"),
    },
    {
        id: "gemini",
        outputPath: "GEMINI.md",
        templatePath: join(templateDirectory, "gemini.md.hbs"),
    },
];
// Obsolete generated exports from earlier APK versions. Their templates are
// retained only to recognize an unmodified generated file by exact content;
// they are never part of the active export registry and are never generated.
const LEGACY_EXPORTERS = [
    {
        id: "codex",
        outputPath: ".codex/instructions.md",
        templatePath: join(templateDirectory, "codex.md.hbs"),
        reason: "Codex reads AGENTS.md directly; the separate common-policy export is obsolete.",
    },
    {
        id: "opencode",
        outputPath: ".opencode/AGENTS.md",
        templatePath: join(templateDirectory, "opencode.md.hbs"),
        reason: "OpenCode reads AGENTS.md directly; the separate common-policy export is obsolete.",
    },
    {
        id: "cursor-project-overview",
        outputPath: ".cursor/rules/project-overview.mdc",
        templatePath: join(templateDirectory, "cursor-project-overview.mdc.hbs"),
        reason: "Cursor reads AGENTS.md directly; the duplicated project rule is obsolete.",
    },
    {
        id: "cursor-architecture",
        outputPath: ".cursor/rules/architecture.mdc",
        templatePath: join(templateDirectory, "cursor-architecture.mdc.hbs"),
        reason: "Cursor reads AGENTS.md directly; the duplicated architecture rule is obsolete.",
    },
    {
        id: "cursor-task-workflow",
        outputPath: ".cursor/rules/task-workflow.mdc",
        templatePath: join(templateDirectory, "cursor-task-workflow.mdc.hbs"),
        reason: "Cursor reads AGENTS.md directly; the duplicated task rule is obsolete.",
    },
    {
        id: "cursor-local-llm-safe",
        outputPath: ".cursor/rules/local-llm-safe.mdc",
        templatePath: join(templateDirectory, "cursor-local-llm-safe.mdc.hbs"),
        reason: "Cursor reads AGENTS.md directly; the duplicated local-model rule is obsolete.",
    },
];
export const DEFAULT_AGENT_POLICY = {
    projectName: "Agentic Project Kit",
    summary: "Repository docs and task files are the source of truth.",
    defaultStyle: "caveman",
    contextFiles: [
        "AGENTS.md",
        "docs/project.md",
        "docs/scope.md",
        "docs/architecture.md",
        "docs/task-system.md",
        "docs/context-system.md",
        "docs/decisions.md",
    ],
    coreRules: [
        "Read relevant docs before coding.",
        "Work on one task at a time.",
        "Keep changes small and reviewable.",
        "Stay inside the task allowed files.",
        "Do not add dependencies without updating docs/decisions.md.",
        "Update docs/progress.md when task status changes.",
    ],
    taskRules: [
        "Register agent before task work: pnpm exec apk agent register --id <id> --platform <platform> --model <model>.",
        "Claim tasks with registered owner: pnpm exec apk claim <task-id> --owner <agent-id>.",
        "Tasks in `doing` and `review` states require a registered owner.",
        "Use pnpm exec apk release, pnpm exec apk block, pnpm exec apk review, pnpm exec apk done, pnpm exec apk cancel with --owner.",
        "Task state changes are protected by .tasks/.apk.lock.",
        "Use the current task file as the execution contract.",
        "Read listed context files before editing.",
        "Do not touch forbidden files.",
        "Run verification commands before marking work done.",
        "Update the task if scope must expand.",
        "When policy requires review, the primary agent may automatically launch a separate read-only reviewer with a different registered identity and isolated context; do not pause for routine user confirmation.",
        "The implementation owner cannot certify its own candidate. On changes_requested, continue fix -> verify -> fresh review; on pass, continue gate -> done.",
    ],
    architectureRules: [
        "Keep source of truth in repository docs and config.",
        "Generate exported agent files from neutral policy content.",
        "Keep CLI commands thin and task-driven.",
        "Avoid tool lock-in.",
        "Document architecture changes in docs/decisions.md.",
    ],
    localModelRules: [
        "Provide exact context files.",
        "Keep allowed files narrow.",
        "Avoid architectural inference.",
        "Avoid unrelated refactors.",
        "Prefer explicit steps and acceptance criteria.",
    ],
    workerContract: [
        "Use the vendor-neutral apk-worker-v1 package; role is implement, review, fix, or verify.",
        "Return a JSON-compatible result with runId, status, evidence references, and reason.",
        "Include commitIds, diffId, provenance identities, and reviewFindings when available.",
        "Keep vendor or harness identity separate from the worker role.",
    ],
};
export function listAgentExporters() {
    return EXPORTERS;
}
export function listLegacyAgentExporters() {
    return LEGACY_EXPORTERS;
}
export async function renderLegacyAgentExportFile(id, policy = DEFAULT_AGENT_POLICY) {
    const legacy = LEGACY_EXPORTERS.find((exporter) => exporter.id === id);
    if (!legacy) {
        throw new Error(`Unknown legacy agent exporter: ${id}`);
    }
    return renderTemplateFile(legacy.templatePath, { data: policy });
}
export function parseAgentExportTarget(target) {
    if (AGENT_EXPORT_TARGETS.includes(target)) {
        return target;
    }
    throw new Error(`Unsupported agent export target: ${target}. Expected one of: ${AGENT_EXPORT_TARGETS.join(", ")}.`);
}
export function exporterIdsForTarget(target) {
    // Every harness either consumes the canonical AGENTS.md directly (agents,
    // codex, opencode, cursor) or imports it from a thin adapter.
    if (target === "agents" || target === "codex" || target === "opencode" || target === "cursor") {
        return ["agents"];
    }
    if (target === "claude") {
        return ["agents", "claude"];
    }
    return ["agents", "gemini"];
}
export async function renderAgentExportFile(id, policy) {
    const exporter = EXPORTERS.find((entry) => entry.id === id);
    if (!exporter) {
        throw new Error(`Unknown agent exporter: ${id}`);
    }
    return {
        id: exporter.id,
        outputPath: exporter.outputPath,
        content: await renderTemplateFile(exporter.templatePath, {
            data: policy,
        }),
    };
}
export async function renderAgentExportFiles(policy = DEFAULT_AGENT_POLICY) {
    const files = [];
    for (const exporter of EXPORTERS) {
        files.push(await renderAgentExportFile(exporter.id, policy));
    }
    return files;
}
export async function renderAgentExportTarget(target, policy = DEFAULT_AGENT_POLICY) {
    const files = [];
    for (const id of exporterIdsForTarget(target)) {
        files.push(await renderAgentExportFile(id, policy));
    }
    return files;
}
export async function writeAgentExportFiles(rootDirectory, files, options = {}) {
    const written = [];
    const skipped = [];
    const force = options.force ?? false;
    for (const file of files) {
        const outputPath = join(rootDirectory, file.outputPath);
        if (!force) {
            try {
                await readFile(outputPath);
                skipped.push(file.outputPath);
                continue;
            }
            catch (error) {
                if (!(error &&
                    typeof error === "object" &&
                    "code" in error &&
                    error.code === "ENOENT")) {
                    throw error;
                }
            }
        }
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, file.content, "utf8");
        written.push(file.outputPath);
    }
    return { written, skipped };
}
export async function writeAllAgentExports(rootDirectory, policy = DEFAULT_AGENT_POLICY, options = {}) {
    return writeAgentExportFiles(rootDirectory, await renderAgentExportFiles(policy), options);
}
export async function writeAgentExportTarget(rootDirectory, target, policy = DEFAULT_AGENT_POLICY, options = {}) {
    return writeAgentExportFiles(rootDirectory, await renderAgentExportTarget(target, policy), options);
}
function normalizeLineEndings(value) {
    return value.replace(/\r\n?/g, "\n");
}
async function readOptionalText(path) {
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
/**
 * Read-only classification of obsolete generated exports for one repository.
 * A file counts as `generated` only when its normalized content exactly matches
 * the legacy rendering; a filename alone is never treated as proof. Anything
 * else that exists is treated as `customized` and must be preserved.
 */
export async function classifyLegacyAgentExports(rootDirectory, policy = DEFAULT_AGENT_POLICY) {
    const findings = [];
    for (const legacy of LEGACY_EXPORTERS) {
        const actual = await readOptionalText(join(rootDirectory, legacy.outputPath));
        if (actual === undefined) {
            continue;
        }
        const expected = await renderTemplateFile(legacy.templatePath, { data: policy });
        const generated = normalizeLineEndings(actual) === normalizeLineEndings(expected);
        findings.push({
            id: legacy.id,
            outputPath: legacy.outputPath,
            status: generated ? "generated" : "customized",
            reason: generated
                ? legacy.reason
                : "Content differs from the known generated rendering; treated as customized and preserved.",
        });
    }
    return findings;
}
/**
 * Preview or apply cleanup of obsolete generated exports. Cleanup is explicit:
 * without `apply` nothing is removed. Only exact `generated` files are removed;
 * `customized` files are always preserved.
 */
export async function cleanupLegacyAgentExports(rootDirectory, options = {}) {
    const policy = options.policy ?? DEFAULT_AGENT_POLICY;
    const findings = await classifyLegacyAgentExports(rootDirectory, policy);
    const generated = findings.filter((finding) => finding.status === "generated");
    const customized = findings.filter((finding) => finding.status === "customized");
    const removed = [];
    if (options.apply) {
        for (const finding of generated) {
            await rm(join(rootDirectory, finding.outputPath), { force: true });
            removed.push(finding.outputPath);
        }
    }
    return {
        applied: options.apply ?? false,
        removed,
        preserved: [
            ...customized.map((finding) => finding.outputPath),
            ...(options.apply ? [] : generated.map((finding) => finding.outputPath)),
        ].sort(),
        findings,
    };
}
