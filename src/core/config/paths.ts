const WINDOWS_DRIVE = /^[A-Za-z]:/;
const WINDOWS_ABSOLUTE = /^[A-Za-z]:[\\/]/;
const WINDOWS_UNC = /^\\\\/;

function hasControlCharacters(value: string): boolean {
  return /[\0\r\n]/.test(value);
}

/**
 * Lexical repository-relative directory contract. Filesystem operations still
 * need their own symlink/containment checks; this rejects ambiguous config
 * forms before any path is used.
 */
export function repositoryRelativeDirectoryIssue(value: string): string | undefined {
  if (value.length === 0) return "must be a non-empty repository-relative directory";
  if (hasControlCharacters(value)) return "must not contain control characters";
  if (WINDOWS_ABSOLUTE.test(value) || WINDOWS_DRIVE.test(value)) return "must not be an absolute Windows path";
  if (WINDOWS_UNC.test(value)) return "must not be a Windows UNC path";
  if (value.startsWith("/")) return "must not be an absolute path";
  if (value.startsWith("~")) return "must be repository-relative";
  if (value.includes("\\")) return "must use forward slashes";

  const trimmed = value.replace(/\/+$/, "");
  if (trimmed.length === 0) return "must not resolve to the repository root";
  const segments = trimmed.split("/");
  if (segments.some((segment) => segment.length === 0)) return "must not contain empty path segments";
  if (segments.some((segment) => segment === "." || segment === "..")) return "must not contain dot segments";
  return undefined;
}

/** Normalize only an optional trailing separator; never rewrite user config. */
export function canonicalRepositoryRelativeDirectory(value: string): string {
  return value.replace(/\/+$/, "");
}
