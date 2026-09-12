import { resolve } from "node:path";
import { adoptRepository, planAdoption } from "../../core/docs/adopt.js";
const ADOPT_HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    "  apk adopt [directory] [--preview|--dry-run|--apply]",
    "",
    "Scans an existing repository and adds kit docs without rewriting source code.",
    "--preview/--dry-run reports exact changes without writing; --apply explicitly migrates legacy config.",
].join("\n");
function hasHelpFlag(argv) {
    return argv.includes("--help") || argv.includes("-h");
}
export async function runAdoptCommand(argv) {
    if (hasHelpFlag(argv)) {
        console.log(ADOPT_HELP_TEXT);
        return 0;
    }
    const flags = new Set(["--preview", "--dry-run", "--apply"]);
    for (const arg of argv) {
        if (arg.startsWith("-") && !flags.has(arg)) {
            console.error(`Unknown option: ${arg}`);
            return 1;
        }
    }
    const positional = argv.filter((arg) => !arg.startsWith("-"));
    if (positional.length > 1 || (argv.includes("--preview") && (argv.includes("--dry-run") || argv.includes("--apply"))) || (argv.includes("--dry-run") && argv.includes("--apply"))) {
        console.error("Usage: apk adopt [directory] [--preview|--dry-run|--apply]");
        return 1;
    }
    try {
        const rootDirectory = resolve(positional[0] ?? process.cwd());
        const preview = argv.includes("--preview") || argv.includes("--dry-run");
        if (preview) {
            const plan = await planAdoption(rootDirectory, { includeMigration: true });
            console.log(`Adoption preview for ${rootDirectory}`);
            console.log(`Compatibility: ${plan.compatibility.overall}`);
            console.log(`Config: ${plan.compatibility.config.state}${plan.compatibility.config.schemaVersion ? ` v${plan.compatibility.config.schemaVersion}` : ""}`);
            console.log(`Tasks: ${plan.compatibility.tasks.contract} (legacy=${plan.compatibility.tasks.legacy}, gated=${plan.compatibility.tasks.gated}, unknown=${plan.compatibility.tasks.unknown})`);
            console.log("Proposed changes:");
            if (plan.changes.length === 0)
                console.log("- none");
            for (const change of plan.changes) {
                console.log(`- ${change.action} ${change.path}: ${change.reason}`);
            }
            for (const diagnostic of plan.diagnostics) {
                console.error(`Warning: ${diagnostic}`);
            }
            console.log("No files were written.");
            return 0;
        }
        const result = await adoptRepository(rootDirectory, { applyMigration: argv.includes("--apply") });
        console.log(`Adopted Agentic Project Kit in ${rootDirectory}`);
        console.log(`Detected stack: ${result.scan.detectedStack.join(", ") || "unknown"}`);
        console.log(`Created ${result.created.length} file(s).`);
        console.log(`Updated ${result.updated.length} file(s).`);
        console.log(`Compatibility: ${result.compatibility.overall}`);
        if (result.skipped.length > 0) {
            console.log(`Skipped ${result.skipped.length} existing file(s).`);
        }
        for (const diagnostic of result.diagnostics) {
            console.error(`Warning: ${diagnostic}`);
        }
        return 0;
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 1;
    }
}
