import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_NAME = "agentic-project-kit";
const MAX_MANIFEST_BYTES = 64 * 1024;
// Numeric prerelease identifiers cannot have leading zeroes; build identifiers can.
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

async function readManifest(path: string): Promise<string | undefined> {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return undefined;
    throw new Error("APK package manifest is unreadable.");
  }
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > MAX_MANIFEST_BYTES) throw new Error("APK package manifest must be a regular file within 64 KiB.");
    const buffer = Buffer.alloc(MAX_MANIFEST_BYTES + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, null);
      if (bytesRead === 0) break;
      size += bytesRead;
    }
    if (size > MAX_MANIFEST_BYTES) throw new Error("APK package manifest exceeds 64 KiB.");
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, size));
  } finally {
    await handle.close();
  }
}

/** Both supported layouts are <package>/{src,dist}/cli. Never walk past
 * that package boundary, fall back to cwd, or reuse a value across calls. */
export async function readCliVersion(moduleUrl: string = import.meta.url): Promise<string> {
  let directory = dirname(fileURLToPath(moduleUrl));
  for (let depth = 0; depth <= 2; depth++) {
    const content = await readManifest(join(directory, "package.json"));
    if (content !== undefined) {
      let manifest: unknown;
      try {
        manifest = JSON.parse(content);
      } catch {
        throw new Error("APK package manifest is not valid JSON.");
      }
      if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) || !("name" in manifest) || manifest.name !== PACKAGE_NAME) {
        throw new Error("APK package manifest must identify agentic-project-kit; refusing another package.");
      }
      if (!("version" in manifest) || typeof manifest.version !== "string" || manifest.version.length > 128 || manifest.version.trim() !== manifest.version || !SEMVER.test(manifest.version)) {
        throw new Error("APK package manifest must contain a valid SemVer version.");
      }
      return `${PACKAGE_NAME} ${manifest.version}`;
    }
    directory = dirname(directory);
  }
  throw new Error("APK package manifest is missing within the CLI package boundary.");
}
