import {
  resetLocalCommunicationLanguage,
  resolveCommunicationLanguage,
  resolveLocalPreferencesPath,
  writeLocalCommunicationLanguage,
} from "../../core/config/index.js";

const LANGUAGE_HELP_TEXT = [
  "Agentic Project Kit",
  "",
  "Usage:",
  "  apk language [show]",
  "  apk language set <tag>",
  "  apk language reset",
  "",
  "Inspect, set, or reset the developer-local human communication language.",
  "The preference is stored outside the repository and is never Git-tracked;",
  "repository-owned artifacts and machine-readable output stay canonical English.",
].join("\n");

function hasHelpFlag(argv: readonly string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function describeSource(source: "explicit" | "local" | "default"): string {
  if (source === "explicit") return "explicit session override";
  if (source === "local") return "local preference";
  return "default (English fallback)";
}

export async function runLanguageCommand(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    console.log(LANGUAGE_HELP_TEXT);
    return 0;
  }

  const [subcommand, ...rest] = argv;

  try {
    if (subcommand === undefined || subcommand === "show") {
      if (rest.length > 0) {
        throw new Error("Usage: apk language [show]");
      }

      const resolved = await resolveCommunicationLanguage({
        explicit: process.env.APK_COMMUNICATION_LANGUAGE,
      });
      console.log(`Communication language: ${resolved.language}`);
      console.log(`Source: ${describeSource(resolved.source)}`);
      console.log(`Preference file: ${resolveLocalPreferencesPath()}`);
      return 0;
    }

    if (subcommand === "set") {
      if (rest.length !== 1) {
        throw new Error("Usage: apk language set <tag>");
      }

      const language = await writeLocalCommunicationLanguage(rest[0]!);
      console.log(`Communication language set: ${language}`);
      console.log(`Preference file: ${resolveLocalPreferencesPath()}`);
      return 0;
    }

    if (subcommand === "reset") {
      if (rest.length > 0) {
        throw new Error("Usage: apk language reset");
      }

      const removed = await resetLocalCommunicationLanguage();
      console.log(removed
        ? "Communication language preference reset to the English default."
        : "No local communication language preference was set.");
      return 0;
    }

    throw new Error(
      `Unknown language subcommand: ${subcommand}. Usage: apk language [show|set <tag>|reset]`,
    );
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
