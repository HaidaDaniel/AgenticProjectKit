import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseAgenticConfigJson, serializeAgenticConfig, } from "./schema.js";
export const CONFIG_PATH = ".agentic/config.json";
function isMissingFileError(error) {
    return (error !== null &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT");
}
export async function readAgenticConfigFile(rootDirectory) {
    try {
        return parseAgenticConfigJson(await readFile(join(rootDirectory, CONFIG_PATH), "utf8"));
    }
    catch (error) {
        if (isMissingFileError(error)) {
            return parseAgenticConfigJson("{}");
        }
        throw error;
    }
}
export async function writeAgenticConfigFile(rootDirectory, config) {
    const path = join(rootDirectory, CONFIG_PATH);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, serializeAgenticConfig(config), "utf8");
}
