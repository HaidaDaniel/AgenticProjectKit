import { execFile } from "node:child_process";
import { lstat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export interface ArchiveGitSafety {
  status: "safe" | "ignored" | "unknown" | "non-git";
  blocker?: string;
}

async function hasGitMarker(rootDirectory: string): Promise<boolean> {
  let directory = resolve(rootDirectory);
  for (let depth = 0; depth < 64; depth++) {
    try {
      await lstat(join(directory, ".git"));
      return true;
    } catch (error: unknown) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
    }
    const parent = dirname(directory);
    if (parent === directory) return false;
    directory = parent;
  }
  throw new Error("repository marker inspection exceeds the 64-parent limit");
}

// One bounded Git query for a preview/lint batch, with no shell or index writes.
function inspectGit(rootDirectory: string, args: string[], input?: string): Promise<{
  code: number; stdout: string; stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = execFile("git", args, {
      cwd: rootDirectory,
      env: { ...process.env, LC_ALL: "C", GIT_OPTIONAL_LOCKS: "0" },
      encoding: "buffer",
      maxBuffer: 4 * 1024 * 1024,
      timeout: 5000,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      if (error && (typeof error.code !== "number" || error.killed || error.signal)) {
        reject(error);
        return;
      }
      try {
        const decoder = new TextDecoder("utf-8", { fatal: true });
        resolve({ code: error && typeof error.code === "number" ? error.code : 0, stdout: decoder.decode(stdout), stderr: decoder.decode(stderr) });
      } catch (decodeError: unknown) {
        reject(decodeError);
      }
    });
    child.stdin?.on("error", () => { /* The process callback reports failed inspection. */ });
    child.stdin?.end(input);
  });
}

export async function inspectArchiveGitSafety(
  rootDirectory: string,
  destinations: readonly string[],
): Promise<Map<string, ArchiveGitSafety>> {
  const paths = [...new Set(destinations)];
  const all = (value: ArchiveGitSafety): Map<string, ArchiveGitSafety> => new Map(paths.map((path) => [path, value]));
  if (paths.length === 0) return new Map();
  try {
    const input = `${paths.join("\0")}\0`;
    if (paths.length > 4096 || Buffer.byteLength(input) > 1024 * 1024 || paths.some((path) => path.includes("\0"))) {
      throw new Error("destination inspection exceeds the 4096-path / 1 MiB limit or contains a NUL path");
    }
    const repository = await inspectGit(rootDirectory, ["rev-parse", "--is-inside-work-tree"]);
    if (repository.code === 128 && /^fatal: not a git repository \(or any/i.test(repository.stderr) && !(await hasGitMarker(rootDirectory))) {
      return all({ status: "non-git" });
    }
    if (repository.code !== 0 || repository.stdout.trim() !== "true" || repository.stderr) {
      throw new Error(repository.stderr || "Git did not identify an ordinary worktree");
    }
    // --no-index also diagnoses already tracked archives that future moves would lose.
    const result = await inspectGit(rootDirectory,
      ["check-ignore", "--no-index", "--verbose", "--non-matching", "-z", "--stdin"], input);
    if (![0, 1].includes(result.code) || result.stderr) {
      throw new Error(result.stderr || `git check-ignore exited ${result.code}`);
    }
    const fields = result.stdout.split("\0");
    if (fields.pop() !== "" || fields.length !== paths.length * 4) {
      throw new Error("incomplete Git ignore response");
    }
    const inspected = new Map<string, ArchiveGitSafety>();
    for (let i = 0; i < paths.length; i++) {
      const [source, line, pattern, path] = fields.slice(i * 4, i * 4 + 4);
      if (path !== paths[i] || (source && !/^\d+$/.test(line)) || (!source && (line || pattern))) {
        throw new Error("unexpected Git ignore response");
      }
      inspected.set(path, source && !pattern.startsWith("!") ? {
        status: "ignored",
        blocker: `Archive destination ${JSON.stringify(path)} is ignored by ${JSON.stringify(source)}:${line} (${JSON.stringify(pattern)}). Manually repair the effective ignore rule and re-run preview; APK does not force-add files or change Git tracking.`,
      } : { status: "safe" });
    }
    return inspected;
  } catch (error: unknown) {
    const detail = (error instanceof Error ? error.message : String(error)).slice(0, 800);
    return all({ status: "unknown", blocker: `Cannot establish archive Git safety: ${detail}. Restore Git inspection and re-run preview; no move is permitted.` });
  }
}
