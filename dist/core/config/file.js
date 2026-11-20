import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolveContainedAgenticPath } from "./paths.js";
import { parseAgenticConfigJson, serializeAgenticConfig, } from "./schema.js";
export const CONFIG_PATH = ".agentic/config.json";
function isMissingFileError(error) {
    return (error !== null &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT");
}
export async function readAgenticConfigFile(rootDirectory, read = (path) => readFile(path, "utf8")) {
    try {
        return parseAgenticConfigJson(await read(join(rootDirectory, CONFIG_PATH)));
    }
    catch (error) {
        if (isMissingFileError(error)) {
            return parseAgenticConfigJson("{}");
        }
        throw error;
    }
}
export async function writeAgenticConfigFile(rootDirectory, config) {
    await resolveContainedAgenticPath(rootDirectory, CONFIG_PATH, "file");
    const path = join(rootDirectory, CONFIG_PATH);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, serializeAgenticConfig(config), "utf8");
}
