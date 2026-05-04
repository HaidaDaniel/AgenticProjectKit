import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  parseAgenticConfigJson,
  serializeAgenticConfig,
} from "./schema.js";
import type { AgenticConfig } from "./types.js";

export const CONFIG_PATH = ".agentic/config.json";

function isMissingFileError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export async function readAgenticConfigFile(
  rootDirectory: string,
): Promise<AgenticConfig> {
  try {
    return parseAgenticConfigJson(
      await readFile(join(rootDirectory, CONFIG_PATH), "utf8"),
    );
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return parseAgenticConfigJson("{}");
    }

    throw error;
  }
}

export async function writeAgenticConfigFile(
  rootDirectory: string,
  config: AgenticConfig,
): Promise<void> {
  const path = join(rootDirectory, CONFIG_PATH);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, serializeAgenticConfig(config), "utf8");
}
