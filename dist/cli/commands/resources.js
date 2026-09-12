import { resolve } from "node:path";
import { emptyResourceRegistry, renderResourceRegistry, } from "../../core/resources/index.js";
import { detectResourceInventory, renderResourceInventory, } from "../../core/resources/detect.js";
import { readAgenticConfigFile } from "../../core/config/index.js";
const RESOURCES_HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    "  apk resources [--json]",
    "  apk resources detect [--json]",
    "",
    "Print the configured vendor-neutral resource registry without probing providers or starting workers.",
    "Use `detect` for a deterministic, read-only inventory of declared resources, local harness markers, and quality capabilities.",
].join("\n");
export async function runResourcesCommand(argv) {
    if (argv.includes("--help") || argv.includes("-h")) {
        console.log(RESOURCES_HELP_TEXT);
        return 0;
    }
    const json = argv.includes("--json");
    const positional = argv.filter((arg) => arg !== "--json");
    try {
        const rootDirectory = resolve(process.cwd());
        if (positional[0] === "detect") {
            if (positional.length !== 1 || positional.some((arg) => arg.startsWith("-"))) {
                console.error(RESOURCES_HELP_TEXT);
                return 1;
            }
            const inventory = await detectResourceInventory(rootDirectory);
            console.log(renderResourceInventory(inventory, json));
            return 0;
        }
        if (positional.length > 0) {
            console.error(RESOURCES_HELP_TEXT);
            return 1;
        }
        const config = await readAgenticConfigFile(rootDirectory);
        console.log(renderResourceRegistry(config.resources ?? emptyResourceRegistry(), json));
        return 0;
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 1;
    }
}
