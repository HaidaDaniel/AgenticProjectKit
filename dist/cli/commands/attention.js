import { resolve } from "node:path";
import { readAgenticConfigFile } from "../../core/config/index.js";
import { buildAttentionView, renderAttentionView, } from "../../core/status/attention.js";
const ATTENTION_HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    "  apk attention [--json]",
    "",
    "Show a bounded, deterministic attention queue derived from task, gate, review, policy, and resource state.",
    "It reports semantic facts only and never claims live process state.",
].join("\n");
export async function runAttentionCommand(argv) {
    if (argv.includes("--help") || argv.includes("-h")) {
        console.log(ATTENTION_HELP_TEXT);
        return 0;
    }
    if (argv.some((arg) => arg !== "--json")) {
        console.error(ATTENTION_HELP_TEXT);
        return 1;
    }
    try {
        const rootDirectory = resolve(process.cwd());
        const config = await readAgenticConfigFile(rootDirectory);
        const view = await buildAttentionView(rootDirectory, config.taskDirectory);
        console.log(renderAttentionView(view, argv.includes("--json")));
        return 0;
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 1;
    }
}
