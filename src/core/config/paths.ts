import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

const WINDOWS_DRIVE = /^[A-Za-z]:/;
const WINDOWS_ABSOLUTE = /^[A-Za-z]:[\\/]/;
const WINDOWS_UNC = /^\\\\/;

export type RepositoryPathKind = "file" | "directory";

/** Actionable refusal for a configured path that could escape the repository. */
export class PathContainmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathContainmentError";
  }
}

function hasControlCharacters(value: string): boolean {
  return /[\0\r\n]/.test(value);
}

function isMissingPathError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && (error.code === "ENOENT" || error.code === "ENOTDIR"),
  );
}

/**
 * Lexical repository-relative path contract. Filesystem operations still need
 * their own symlink/containment checks; this rejects ambiguous config forms
 * before any path is used.
 */
export function repositoryRelativePathIssue(
  value: string,
  kind: RepositoryPathKind = "directory",
): string | undefined {
  if (value.length === 0) return `must be a non-empty repository-relative ${kind}`;
  if (value !== value.trim()) return "must not have leading or trailing whitespace";
  if (hasControlCharacters(value)) return "must not contain control characters";
  if (WINDOWS_ABSOLUTE.test(value) || WINDOWS_DRIVE.test(value)) return "must not be an absolute Windows path";
  if (WINDOWS_UNC.test(value)) return "must not be a Windows UNC path";
  if (value.startsWith("/")) return "must not be an absolute path";
  if (value.startsWith("~")) return "must be repository-relative";
  if (value.includes("\\")) return "must use forward slashes";
  if (kind === "file" && value.endsWith("/")) return "must not end with a directory separator";

  const trimmed = kind === "directory" && value.endsWith("/") ? value.slice(0, -1) : value;
  if (trimmed.length === 0) return "must not resolve to the repository root";
  const segments = trimmed.split("/");
  if (segments.some((segment) => segment.length === 0)) return "must not contain empty path segments";
  if (segments.some((segment) => segment === "." || segment === "..")) return "must not contain dot segments";
  return undefined;
}

export function repositoryRelativeDirectoryIssue(value: string): string | undefined {
  return repositoryRelativePathIssue(value, "directory");
}

/** Normalize one optional trailing separator; never rewrite user config. */
export function canonicalRepositoryRelativeDirectory(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

/**
 * Resolve a repository-relative path for a sensitive mutation and refuse any
 * existing symbolic link in the path. The lexical contract is checked first;
 * then the real repository root and every existing component are inspected
 * with `lstat`.
 *
 * Missing components are allowed because canonical create/init flows must be
 * able to create configured directories and files. This is a best-effort
 * pre-mutation check, not a lock: an external process that replaces a missing
 * component with a symlink after this function returns remains a residual
 * TOCTOU boundary. Callers must perform the check immediately before the
 * mutation and must not repair or follow discovered links.
 */
export async function resolveContainedRepositoryPath(
  rootDirectory: string,
  relativePath: string,
  kind: RepositoryPathKind = "directory",
): Promise<string> {
  const issue = repositoryRelativePathIssue(relativePath, kind);
  if (issue) {
    throw new PathContainmentError(
      `Refusing to use ${JSON.stringify(relativePath)} as a repository-relative ${kind}: ${issue}.`,
    );
  }

  let rootReal: string;
  try {
    rootReal = await realpath(rootDirectory);
  } catch {
    throw new PathContainmentError(`Repository root is unavailable for containment check: ${rootDirectory}.`);
  }

  const absolute = resolve(rootReal, relativePath);
  const relation = relative(rootReal, absolute);
  if (relation === "" || relation === ".." || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    throw new PathContainmentError(
      `Refusing to use ${JSON.stringify(relativePath)}: it escapes the repository root.`,
    );
  }

  const segments = relation.split(sep);
  let current = rootReal;
  for (const [index, segment] of segments.entries()) {
    current = join(current, segment);
    let info;
    try {
      info = await lstat(current);
    } catch (error: unknown) {
      if (isMissingPathError(error)) return absolute;
      throw new PathContainmentError(
        `Cannot inspect repository path ${JSON.stringify(relativePath)} at ${JSON.stringify(relative(rootReal, current))}: `
        + `${error instanceof Error ? error.message : String(error)}.`,
      );
    }

    if (info.isSymbolicLink()) {
      throw new PathContainmentError(
        `Refusing to use ${JSON.stringify(relativePath)}: path component ${JSON.stringify(relative(rootReal, current))} `
        + "is a symbolic link and could escape the repository.",
      );
    }

    const isFinal = index === segments.length - 1;
    if (!isFinal && !info.isDirectory()) {
      throw new PathContainmentError(
        `Refusing to use ${JSON.stringify(relativePath)}: path component ${JSON.stringify(relative(rootReal, current))} `
        + "is not a directory.",
      );
    }
    if (isFinal) {
      if (kind === "directory" && !info.isDirectory()) {
        throw new PathContainmentError(
          `Refusing to use ${JSON.stringify(relativePath)} as a directory: the target exists and is not a directory.`,
        );
      }
      if (kind === "file" && !info.isFile()) {
        throw new PathContainmentError(
          `Refusing to use ${JSON.stringify(relativePath)} as a file: the target exists and is not a regular file.`,
        );
      }
    }
  }

  return absolute;
}
