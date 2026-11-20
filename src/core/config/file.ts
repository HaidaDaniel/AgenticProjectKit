import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { resolveContainedAgenticPath } from "./paths.js";
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

export type ConfigReader = (path: string) => Promise<string>;

export async function readAgenticConfigFile(
  rootDirectory: string,
  read: ConfigReader = (path) => readFile(path, "utf8"),
): Promise<AgenticConfig> {
  try {
    return parseAgenticConfigJson(
      await read(join(rootDirectory, CONFIG_PATH)),
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
  await resolveContainedAgenticPath(rootDirectory, CONFIG_PATH, "file");
  const path = join(rootDirectory, CONFIG_PATH);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, serializeAgenticConfig(config), "utf8");
}
