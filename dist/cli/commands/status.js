import { resolve } from "node:path";
import { renderStatus, summarizeStatus } from "../../core/status/index.js";
const STATUS_HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    "  apk status [--detail]",
    "",
    "Print compact workflow status without modifying files.",
    "Use --detail for bounded gate, evidence and provenance diagnostics.",
].join("\n");
function hasHelpFlag(argv) {
    return argv.includes("--help") || argv.includes("-h");
}
export async function runStatusCommand(argv) {
    if (hasHelpFlag(argv)) {
        console.log(STATUS_HELP_TEXT);
        return 0;
    }
    if (argv.some((arg) => arg !== "--detail")) {
        console.error("Usage: apk status [--detail]");
        return 1;
    }
    try {
        console.log(renderStatus(await summarizeStatus(resolve(process.cwd())), {
            detail: argv.includes("--detail"),
        }));
        return 0;
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 1;
    }
}
