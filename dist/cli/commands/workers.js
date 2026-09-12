import { resolve } from "node:path";
import { readAgenticConfigFile } from "../../core/config/index.js";
import { buildAttentionView, renderWorkersView, } from "../../core/status/attention.js";
const WORKERS_HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    "  apk workers [--json]",
    "",
    "Show declared worker/resources and their semantic capacity state.",
    "Occupancy is derived from declared state; it is never a live process observation.",
].join("\n");
export async function runWorkersCommand(argv) {
    if (argv.includes("--help") || argv.includes("-h")) {
        console.log(WORKERS_HELP_TEXT);
        return 0;
    }
    if (argv.some((arg) => arg !== "--json")) {
        console.error(WORKERS_HELP_TEXT);
        return 1;
    }
    try {
        const rootDirectory = resolve(process.cwd());
        const config = await readAgenticConfigFile(rootDirectory);
        const view = await buildAttentionView(rootDirectory, config.taskDirectory);
        console.log(renderWorkersView(view, argv.includes("--json")));
        return 0;
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 1;
    }
}
