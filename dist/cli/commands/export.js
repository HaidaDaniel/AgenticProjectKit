import { resolve } from "node:path";
import { readAgenticConfigFile } from "../../core/config/index.js";
import { DEFAULT_AGENT_POLICY, classifyLegacyAgentExports, cleanupLegacyAgentExports, parseAgentExportTarget, writeAgentExportTarget, writeAllAgentExports, } from "../../core/exporters/index.js";
const EXPORT_HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    "  apk export [--force]",
    "  apk export <agent> [--force]",
    "  apk export --report-legacy",
    "  apk export --cleanup-legacy",
    "",
    "Agents:",
    "  agents   canonical AGENTS.md (full policy)",
    "  claude   thin CLAUDE.md adapter importing AGENTS.md",
    "  gemini   thin GEMINI.md adapter importing AGENTS.md",
    "  codex    alias for AGENTS.md (Codex reads it directly)",
    "  opencode alias for AGENTS.md (OpenCode reads it directly)",
    "  cursor   alias for AGENTS.md (Cursor reads it directly)",
    "",
    "--report-legacy previews obsolete generated exports without writing.",
    "--cleanup-legacy removes only exact unmodified generated obsolete files.",
].join("\n");
function hasHelpFlag(argv) {
    return argv.includes("--help") || argv.includes("-h");
}
export async function runExportCommand(argv) {
    if (hasHelpFlag(argv)) {
        console.log(EXPORT_HELP_TEXT);
        return 0;
    }
    const force = argv.includes("--force");
    const reportLegacy = argv.includes("--report-legacy");
    const cleanupLegacy = argv.includes("--cleanup-legacy");
    const targets = argv.filter((arg) => ![
        "--force", "--report-legacy", "--cleanup-legacy",
    ].includes(arg));
    if (targets.length > 1 || targets.some((arg) => arg.startsWith("-"))) {
        console.error("Usage: apk export [agent] [--force]");
        return 1;
    }
    if ((reportLegacy || cleanupLegacy) && targets.length > 0) {
        console.error("Use --report-legacy/--cleanup-legacy without an agent target.");
        return 1;
    }
    try {
        const rootDirectory = resolve(process.cwd());
        const config = await readAgenticConfigFile(rootDirectory);
        const policy = {
            ...DEFAULT_AGENT_POLICY,
            projectName: config.projectName,
            defaultStyle: config.agentStyle,
        };
        if (reportLegacy || cleanupLegacy) {
            if (cleanupLegacy) {
                const cleanup = await cleanupLegacyAgentExports(rootDirectory, { apply: true, policy });
                console.log(`Removed ${cleanup.removed.length} obsolete generated file(s).`);
                for (const file of cleanup.removed) {
                    console.log(`- removed ${file}`);
                }
                console.log(`Preserved ${cleanup.preserved.length} file(s).`);
                for (const file of cleanup.preserved) {
                    console.log(`- preserved ${file}`);
                }
                return 0;
            }
            const findings = await classifyLegacyAgentExports(rootDirectory, policy);
            console.log(`Legacy export report: ${findings.length} obsolete file(s) present.`);
            for (const finding of findings) {
                console.log(`- ${finding.status} ${finding.outputPath}: ${finding.reason}`);
            }
            if (findings.some((finding) => finding.status === "generated")) {
                console.log("Run apk export --cleanup-legacy to remove exact generated obsolete files.");
            }
            return 0;
        }
        const result = targets.length === 0
            ? await writeAllAgentExports(rootDirectory, policy, { force })
            : await writeAgentExportTarget(rootDirectory, parseAgentExportTarget(targets[0]), policy, { force });
        console.log(`Wrote ${result.written.length} file(s).`);
        for (const file of result.written) {
            console.log(`- ${file}`);
        }
        if (result.skipped.length > 0) {
            console.log(`Skipped ${result.skipped.length} existing file(s). Use --force to overwrite.`);
        }
        return 0;
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 1;
    }
}
