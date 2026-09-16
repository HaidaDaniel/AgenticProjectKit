import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Developer-local preferences are intentionally outside the repository. They
 * describe the human's interaction environment, not repository truth, so they
 * must never create a Git diff in a downstream project.
 */
export const DEFAULT_COMMUNICATION_LANGUAGE = "en";
export const LOCAL_PREFERENCES_DIRECTORY = "agentic-project-kit";
export const LOCAL_PREFERENCES_FILE = "preferences.json";

export interface LocalPreferences {
  communicationLanguage?: string;
}

export interface LocalPreferencesEnvironment {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  home?: string;
}

const LANGUAGE_TAG_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;

export function normalizeCommunicationLanguage(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const text = value.trim();
  if (text.length === 0 || !LANGUAGE_TAG_PATTERN.test(text)) {
    return undefined;
  }

  return text.toLowerCase();
}

function isMissingFileError(error: unknown): boolean {
  return (
    error !== null
    && typeof error === "object"
    && "code" in error
    && error.code === "ENOENT"
  );
}

/**
 * Deterministic developer-local preference location. `APK_LOCAL_CONFIG_HOME`
 * is an explicit escape hatch for tests and unusual environments; otherwise the
 * platform convention is used (Windows APPDATA/LOCALAPPDATA, macOS Application
 * Support, Linux/XDG `$XDG_CONFIG_HOME` or `~/.config`).
 */
export function resolveLocalPreferencesPath(
  environment: LocalPreferencesEnvironment = {},
): string {
  const platform = environment.platform ?? process.platform;
  const env = environment.env ?? process.env;
  const home = environment.home ?? homedir();

  const override = env.APK_LOCAL_CONFIG_HOME?.trim();
  if (override) {
    return join(override, LOCAL_PREFERENCES_DIRECTORY, LOCAL_PREFERENCES_FILE);
  }

  if (platform === "win32") {
    const appData = env.APPDATA?.trim()
      || env.LOCALAPPDATA?.trim()
      || join(home, "AppData", "Roaming");
    return join(appData, LOCAL_PREFERENCES_DIRECTORY, LOCAL_PREFERENCES_FILE);
  }

  if (platform === "darwin") {
    return join(
      home,
      "Library",
      "Application Support",
      LOCAL_PREFERENCES_DIRECTORY,
      LOCAL_PREFERENCES_FILE,
    );
  }

  const xdg = env.XDG_CONFIG_HOME?.trim();
  const base = xdg && xdg.length > 0 ? xdg : join(home, ".config");
  return join(base, LOCAL_PREFERENCES_DIRECTORY, LOCAL_PREFERENCES_FILE);
}

async function readRawPreferences(path: string): Promise<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return {};
    }

    // A malformed local file is treated as "no preference"; set/reset overwrite it.
    return {};
  }
}

export async function readLocalPreferences(path?: string): Promise<LocalPreferences> {
  const resolved = path ?? resolveLocalPreferencesPath();
  const raw = await readRawPreferences(resolved);
  const language = normalizeCommunicationLanguage(raw.communicationLanguage);
  return language ? { communicationLanguage: language } : {};
}

export async function writeLocalCommunicationLanguage(
  language: string,
  path?: string,
): Promise<string> {
  const normalized = normalizeCommunicationLanguage(language);
  if (!normalized) {
    throw new Error(
      `Unsupported communication language: ${language}. Use a short language tag such as en, ru, or uk.`,
    );
  }

  const resolved = path ?? resolveLocalPreferencesPath();
  const raw = await readRawPreferences(resolved);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(
    resolved,
    `${JSON.stringify({ ...raw, communicationLanguage: normalized }, null, 2)}\n`,
    "utf8",
  );
  return normalized;
}

export async function resetLocalCommunicationLanguage(path?: string): Promise<boolean> {
  const resolved = path ?? resolveLocalPreferencesPath();
  try {
    await stat(resolved);
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }

  await rm(resolved, { force: true });
  return true;
}

export type CommunicationLanguageSource = "explicit" | "local" | "default";

export interface ResolvedCommunicationLanguage {
  language: string;
  source: CommunicationLanguageSource;
}

/**
 * Resolution precedence: explicit current-invocation/session override, then the
 * persisted developer-local preference, then the English fallback. The explicit
 * value is never persisted by this function.
 */
export async function resolveCommunicationLanguage(options: {
  explicit?: string;
  path?: string;
} = {}): Promise<ResolvedCommunicationLanguage> {
  const explicit = normalizeCommunicationLanguage(options.explicit);
  if (explicit) {
    return { language: explicit, source: "explicit" };
  }

  const local = (await readLocalPreferences(options.path)).communicationLanguage;
  if (local) {
    return { language: local, source: "local" };
  }

  return { language: DEFAULT_COMMUNICATION_LANGUAGE, source: "default" };
}
