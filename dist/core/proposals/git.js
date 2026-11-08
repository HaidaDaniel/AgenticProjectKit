import { execFile } from "node:child_process";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { findProposal, ProposalFormatError, proposalDirectoryRelative, proposalRevision, } from "./index.js";
const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 15_000;
const GIT_MAX_BUFFER = 4 * 1024 * 1024;
export class ProposalGitError extends Error {
    constructor(message) {
        super(message);
        this.name = "ProposalGitError";
    }
}
async function git(cwd, args, env) {
    try {
        const result = await execFileAsync("git", [...args], {
            cwd,
            encoding: "utf8",
            windowsHide: true,
            timeout: GIT_TIMEOUT_MS,
            maxBuffer: GIT_MAX_BUFFER,
            env: env ?? process.env,
        });
        return { stdout: result.stdout, stderr: result.stderr };
    }
    catch (error) {
        const detail = error && typeof error === "object" && "stderr" in error
            ? String(error.stderr ?? "").trim()
            : error instanceof Error ? error.message : String(error);
        throw new ProposalGitError(`Git command failed (${args.join(" ")}): ${detail || "unknown error"}`);
    }
}
async function gitProbe(cwd, args, env) {
    try {
        const result = await execFileAsync("git", [...args], {
            cwd,
            encoding: "utf8",
            windowsHide: true,
            timeout: GIT_TIMEOUT_MS,
            maxBuffer: GIT_MAX_BUFFER,
            env: env ?? process.env,
        });
        return { ok: true, stdout: result.stdout, stderr: result.stderr };
    }
    catch (error) {
        const stdout = error && typeof error === "object" && "stdout" in error
            ? String(error.stdout ?? "")
            : "";
        const stderr = error && typeof error === "object" && "stderr" in error
            ? String(error.stderr ?? "")
            : "";
        const code = error && typeof error === "object" && "code" in error && typeof error.code === "number"
            ? error.code
            : undefined;
        return { ok: false, stdout, stderr, code };
    }
}
async function assertProspectiveProposalIdentity(rootDirectory, tree, docsDirectory, proposalPath, expectedId) {
    const directory = proposalDirectoryRelative(docsDirectory);
    const found = await gitProbe(rootDirectory, [
        "grep", "-z", "-n", "-I", "-E", "^Proposal-Id:[[:space:]]*", tree, "--", directory,
    ]);
    if (!found.ok && found.code !== 1) {
        throw new ProposalGitError(`Could not inspect proposal identities in the prospective commit tree: ${found.stderr.trim() || "git grep failed"}.`);
    }
    const records = found.stdout.split("\0");
    const identities = new Map();
    const treePrefix = `${tree}:`;
    let index = 0;
    let pendingFile;
    while (index < records.length) {
        const file = pendingFile ?? records[index++];
        pendingFile = undefined;
        if (file === "")
            break;
        const line = records[index++];
        const chunk = records[index++];
        if (line === undefined || chunk === undefined || !/^[0-9]+$/.test(line)) {
            throw new ProposalGitError("Could not parse proposal identity records from the prospective commit tree; refusing to commit.");
        }
        const newline = chunk.indexOf("\n");
        let content;
        if (newline === -1) {
            content = chunk;
        }
        else {
            content = chunk.slice(0, newline);
            const remainder = chunk.slice(newline + 1);
            if (remainder.length > 0)
                pendingFile = remainder;
        }
        if (!file.startsWith(treePrefix)) {
            throw new ProposalGitError(`Unexpected proposal identity record in the prospective commit tree: ${file.slice(0, 160)}.`);
        }
        const path = file.slice(treePrefix.length);
        const match = /^Proposal-Id:[ \t]*(.+)$/.exec(content.replace(/\r$/, ""));
        if (!match) {
            throw new ProposalGitError(`Proposal identity record for ${path} is malformed; refusing to commit.`);
        }
        const id = match[1].trim();
        if (id.length === 0) {
            throw new ProposalGitError(`Proposal identity for ${path} is empty; refusing to commit.`);
        }
        const paths = identities.get(id) ?? [];
        paths.push(path);
        identities.set(id, paths);
    }
    for (const [id, paths] of identities) {
        if (paths.length > 1) {
            throw new ProposalGitError(`Refusing to publish duplicate Proposal-Id ${id} at ${paths.join(", ")}. `
                + "Publish a proposal rename as a separate controlled git mv commit; this command commits only one proposal path.");
        }
    }
    const expectedPaths = identities.get(expectedId) ?? [];
    if (expectedPaths.length !== 1 || expectedPaths[0] !== proposalPath) {
        throw new ProposalGitError(`Prospective commit tree does not contain exactly one ${proposalPath} with Proposal-Id ${expectedId}.`);
    }
}
function singleLine(value, label, maxLength) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (normalized.length === 0 || normalized.length > maxLength) {
        throw new ProposalGitError(`${label} must contain 1-${maxLength} characters.`);
    }
    return normalized;
}
function defaultMessage(item, action) {
    const subject = `${action === "add" ? "add" : "update"} ${item.slug}`;
    return `docs(proposals): ${subject}\n\nProposal-Id: ${item.id}\n`;
}
export async function commitProposal(rootDirectory, docsDirectory, idOrSlug, options = {}) {
    const snapshot = await findProposal(rootDirectory, docsDirectory, idOrSlug);
    if (!snapshot) {
        throw new ProposalFormatError([`Proposal not found: ${idOrSlug}`]);
    }
    if (options.expectedRevision !== undefined && options.expectedRevision !== snapshot.revision) {
        throw new ProposalFormatError([
            `Proposal revision changed: expected ${options.expectedRevision}, found ${snapshot.revision}. Re-read the proposal and retry.`,
        ]);
    }
    const rootReal = await realpath(rootDirectory);
    const topLevel = await gitProbe(rootDirectory, ["rev-parse", "--show-toplevel"]);
    if (!topLevel.ok) {
        throw new ProposalGitError("Proposal commits require a Git repository with a valid worktree.");
    }
    const topReal = await realpath(topLevel.stdout.trim());
    if (topReal !== rootReal) {
        throw new ProposalGitError("Run the proposal commit from the repository root; committing from a nested directory is ambiguous.");
    }
    const symbolic = await gitProbe(rootDirectory, ["symbolic-ref", "-q", "HEAD"]);
    if (!symbolic.ok) {
        throw new ProposalGitError("Proposal commits require an attached branch, not a detached HEAD. Create a branch or use a separate worktree.");
    }
    const headRef = symbolic.stdout.trim();
    const branch = headRef.replace(/^refs\/heads\//, "");
    if (!branch || branch === headRef) {
        throw new ProposalGitError("Could not resolve the current Git branch.");
    }
    const previousHead = (await git(rootDirectory, ["rev-parse", "HEAD"])).stdout.trim();
    if (!previousHead)
        throw new ProposalGitError("Git HEAD is unavailable.");
    const proposalPath = snapshot.proposal.path;
    const ignored = await gitProbe(rootDirectory, ["check-ignore", "-q", "--", proposalPath]);
    if (ignored.ok) {
        throw new ProposalGitError(`Proposal path is excluded by a Git ignore rule: ${proposalPath}. Fix the ignore rule before committing.`);
    }
    const staged = await gitProbe(rootDirectory, ["diff", "--cached", "--quiet", "--", proposalPath]);
    if (!staged.ok) {
        throw new ProposalGitError(`The proposal path has staged changes: ${proposalPath}. Unstage it or use a separate Git worktree.`);
    }
    const before = await readFile(join(rootReal, proposalPath), "utf8");
    if (proposalRevision(before) !== snapshot.revision) {
        throw new ProposalFormatError([
            `Proposal ${snapshot.proposal.slug} changed before the commit began; re-read it and retry.`,
        ]);
    }
    const existsInHead = await gitProbe(rootDirectory, ["cat-file", "-e", `HEAD:${proposalPath}`]);
    const message = options.message
        ? singleLine(options.message, "Commit message", 200)
        : defaultMessage(snapshot.proposal, existsInHead.ok ? "update" : "add");
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "apk-proposal-index-"));
    try {
        const indexFile = join(temporaryDirectory, "index");
        const env = { ...process.env, GIT_INDEX_FILE: indexFile };
        await git(rootReal, ["read-tree", "HEAD"], env);
        await git(rootReal, ["add", "--", proposalPath], env);
        const tree = (await git(rootReal, ["write-tree"], env)).stdout.trim();
        if (!tree)
            throw new ProposalGitError("Git produced an empty tree for the proposal commit.");
        const changed = (await git(rootReal, [
            "diff-tree", "--no-commit-id", "--name-only", "-r", "-z", previousHead, tree,
        ])).stdout.split("\0").filter(Boolean).sort();
        if (changed.length === 0) {
            throw new ProposalGitError(`No proposal changes to commit for ${proposalPath}.`);
        }
        if (changed.length !== 1 || changed[0] !== proposalPath) {
            throw new ProposalGitError(`Refusing to commit unexpected paths: ${changed.join(", ")}. Only ${proposalPath} may be published.`);
        }
        await assertProspectiveProposalIdentity(rootReal, tree, docsDirectory, proposalPath, snapshot.proposal.id);
        await options.runtime?.beforeFinalRevisionCheck?.();
        const after = await readFile(join(rootReal, proposalPath), "utf8");
        if (proposalRevision(after) !== snapshot.revision) {
            throw new ProposalFormatError([
                `Proposal ${snapshot.proposal.slug} changed while the commit was being prepared; re-read it and retry.`,
            ]);
        }
        const commitId = (await git(rootReal, ["commit-tree", tree, "-p", previousHead, "-m", message])).stdout.trim();
        if (!commitId)
            throw new ProposalGitError("Git did not produce a commit id.");
        await options.runtime?.beforeUpdateRef?.({ headRef, commitId, previousHead });
        await git(rootReal, ["update-ref", headRef, commitId, previousHead]);
        // The isolated index never touched the caller index. Synchronize only the
        // committed proposal path so the real index does not appear to delete or
        // hold an older copy of the file; unrelated staged entries stay intact.
        try {
            await git(rootReal, ["reset", "--quiet", "--", proposalPath]);
        }
        catch (error) {
            throw new ProposalGitError(`Commit ${commitId} was created, but the caller index could not be synchronized for ${proposalPath}: `
                + `${error instanceof Error ? error.message : String(error)}. Inspect the index before continuing.`);
        }
        return {
            commitId,
            slug: snapshot.proposal.slug,
            proposalId: snapshot.proposal.id,
            path: proposalPath,
            message: message.trim(),
            branch,
            previousHead,
        };
    }
    finally {
        await rm(temporaryDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
}
