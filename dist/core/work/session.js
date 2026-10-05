import { createHash } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { withLocalMutationLock } from "../tasks/lock.js";
import { parseWorkerPackage, serializeWorkerPackage, validateWorkerRunId, WORKER_PROTOCOL, } from "./contract.js";
export const WORK_SESSION_DIRECTORY = ".agentic/sessions/work";
export const DISCOVERED_SESSION_STATES = ["active", "unactivated", "malformed"];
async function readOptionalText(path) {
    try {
        return await readFile(path, "utf8");
    }
    catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            return undefined;
        }
        throw error;
    }
}
function safeDirectoryNames(entries) {
    return entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) => entry.name)
        .sort();
}
/**
 * Enumerate issued worker sessions across every task. Directories are bounded
 * and sorted; malformed or incomplete sessions are surfaced as diagnostics
 * inputs rather than silently treated as free capacity.
 */
export async function listWorkerSessions(rootDirectory) {
    const base = join(rootDirectory, WORK_SESSION_DIRECTORY);
    let taskEntries;
    try {
        taskEntries = await readdir(base, { withFileTypes: true });
    }
    catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            return [];
        }
        throw error;
    }
    const sessions = [];
    for (const taskId of safeDirectoryNames(taskEntries)) {
        let runEntries;
        try {
            runEntries = await readdir(join(base, taskId), { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const runId of safeDirectoryNames(runEntries)) {
            try {
                validateWorkerRunId(runId);
            }
            catch {
                sessions.push({
                    taskId,
                    runId,
                    activated: false,
                    state: "malformed",
                    reason: "run id is not a safe compact identifier",
                });
                continue;
            }
            const directory = sessionDirectory(rootDirectory, taskId, runId);
            const metadataValue = await readOptionalText(join(directory, "metadata.json"));
            const activationValue = await readOptionalText(join(directory, "activation.json"));
            let activated = false;
            let activationMalformed = false;
            if (activationValue !== undefined) {
                try {
                    const parsedActivation = JSON.parse(activationValue);
                    if (!parsedActivation || typeof parsedActivation !== "object" || Array.isArray(parsedActivation)) {
                        throw new Error("activation is not an object");
                    }
                    const rawActivation = parsedActivation;
                    activated = rawActivation.protocol === WORKER_PROTOCOL
                        && rawActivation.taskId === taskId
                        && rawActivation.runId === runId;
                    if (!activated)
                        activationMalformed = true;
                }
                catch {
                    activationMalformed = true;
                }
            }
            if (metadataValue === undefined) {
                sessions.push({
                    taskId,
                    runId,
                    activated,
                    state: "malformed",
                    reason: "session metadata is missing",
                });
                continue;
            }
            let raw;
            try {
                const parsed = JSON.parse(metadataValue);
                if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
                    throw new Error("metadata is not an object");
                raw = parsed;
            }
            catch (error) {
                sessions.push({
                    taskId,
                    runId,
                    activated,
                    state: "malformed",
                    reason: `session metadata is malformed: ${error instanceof Error ? error.message : String(error)}`,
                });
                continue;
            }
            const owner = typeof raw.owner === "string" ? raw.owner : undefined;
            const role = typeof raw.role === "string" ? raw.role : undefined;
            const resourceId = raw.resourceId === undefined
                ? undefined
                : typeof raw.resourceId === "string" ? raw.resourceId : undefined;
            if (raw.protocol !== WORKER_PROTOCOL
                || raw.taskId !== taskId
                || raw.runId !== runId
                || owner === undefined
                || role === undefined
                || (raw.resourceId !== undefined && typeof raw.resourceId !== "string")) {
                sessions.push({
                    taskId,
                    runId,
                    ...(owner ? { owner } : {}),
                    ...(role ? { role } : {}),
                    ...(resourceId ? { resourceId } : {}),
                    activated,
                    state: "malformed",
                    reason: "session metadata identity is malformed",
                });
                continue;
            }
            if (activationMalformed) {
                sessions.push({
                    taskId,
                    runId,
                    owner,
                    role,
                    ...(resourceId ? { resourceId } : {}),
                    activated: false,
                    state: "malformed",
                    reason: "session activation marker is malformed",
                });
                continue;
            }
            sessions.push({
                taskId,
                runId,
                owner,
                role,
                ...(resourceId ? { resourceId } : {}),
                activated,
                state: activated ? "active" : "unactivated",
                reason: activated ? "activated APK-recorded session" : "issued session has no activation marker",
            });
        }
    }
    return sessions;
}
export const CANONICAL_RUN_BINDING_STATUSES = ["matched", "missing", "malformed", "mismatch", "unavailable"];
/**
 * Single shared primitive that proves the canonical task/run/resource identity
 * of an issued worker session. Workspace creation and cleanup both use it so the
 * binding semantics cannot drift, and no second state store is introduced. A
 * missing, malformed, mismatched, or unreadable session is reported explicitly
 * so callers can fail closed instead of trusting a caller-supplied binding.
 */
export async function resolveCanonicalRunBinding(rootDirectory, taskId, runId, options = {}) {
    let sessions;
    try {
        sessions = await listWorkerSessions(rootDirectory);
    }
    catch (error) {
        return {
            status: "unavailable",
            taskId,
            runId,
            activated: false,
            reason: `canonical worker-session scan failed: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
    const session = sessions.find((entry) => entry.taskId === taskId && entry.runId === runId);
    if (!session) {
        return { status: "missing", taskId, runId, activated: false, reason: "no canonical worker-session record for this task/run" };
    }
    if (session.state === "malformed") {
        return { status: "malformed", taskId, runId, activated: false, reason: "canonical worker-session metadata is malformed" };
    }
    const sessionResourceId = session.resourceId;
    if (options.resourceId !== undefined && sessionResourceId !== options.resourceId) {
        return {
            status: "mismatch",
            taskId,
            runId,
            ...(sessionResourceId ? { resourceId: sessionResourceId } : {}),
            activated: session.activated,
            reason: `canonical session resource ${sessionResourceId ?? "none"} does not match requested resource ${options.resourceId}`,
        };
    }
    return {
        status: "matched",
        taskId,
        runId,
        ...(sessionResourceId ? { resourceId: sessionResourceId } : {}),
        activated: session.activated,
        reason: session.activated
            ? "canonical activated worker session matches task/run/resource"
            : "canonical worker session exists but is not activated",
    };
}
function hashText(value) {
    return createHash("sha256").update(value).digest("hex");
}
function sessionDirectory(rootDirectory, taskId, runId) {
    return join(rootDirectory, WORK_SESSION_DIRECTORY, taskId, runId);
}
export async function withWorkerReviewLifecycleLock(rootDirectory, taskId, runId, run) {
    validateWorkerRunId(runId);
    const lockDirectory = join(rootDirectory, WORK_SESSION_DIRECTORY, ".review-locks");
    await mkdir(lockDirectory, { recursive: true });
    const lockName = `${hashText(`${taskId}\0${runId}`)}.lock`;
    return withLocalMutationLock({
        path: join(lockDirectory, lockName),
        kind: "worker-review-lifecycle",
        command: "worker review lifecycle",
        taskId,
        timeoutMs: 10_000,
    }, run);
}
export async function readActiveWorkerSession(rootDirectory, taskId, runId) {
    validateWorkerRunId(runId);
    const directory = sessionDirectory(rootDirectory, taskId, runId);
    let packageValue;
    let metadataValue;
    try {
        [packageValue, metadataValue] = await Promise.all([
            readFile(join(directory, "package.json"), "utf8"),
            readFile(join(directory, "metadata.json"), "utf8"),
        ]);
    }
    catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            throw new Error(`Worker run ${runId} session is incomplete for task ${taskId}.`);
        }
        throw error;
    }
    let activationValue;
    try {
        activationValue = await readFile(join(directory, "activation.json"), "utf8");
    }
    catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            throw new Error(`Worker run ${runId} is not activated for task ${taskId}.`);
        }
        throw error;
    }
    let metadata;
    let activation;
    try {
        const parsedMetadata = JSON.parse(metadataValue);
        const parsedActivation = JSON.parse(activationValue);
        if (!parsedMetadata || typeof parsedMetadata !== "object" || Array.isArray(parsedMetadata)) {
            throw new Error("metadata is not an object");
        }
        if (!parsedActivation || typeof parsedActivation !== "object" || Array.isArray(parsedActivation)) {
            throw new Error("activation is not an object");
        }
        metadata = parsedMetadata;
        activation = parsedActivation;
    }
    catch (error) {
        throw new Error(`Worker run ${runId} session metadata is malformed: ${error instanceof Error ? error.message : String(error)}.`);
    }
    const workerPackage = parseWorkerPackage(packageValue);
    const actualPackageHash = hashText(serializeWorkerPackage(workerPackage));
    if (metadata.protocol !== WORKER_PROTOCOL
        || metadata.taskId !== taskId
        || metadata.runId !== runId
        || typeof metadata.owner !== "string"
        || metadata.resourceId !== workerPackage.provenance.resourceId
        || workerPackage.task.id !== taskId
        || metadata.role !== workerPackage.role
        || typeof metadata.packageHash !== "string"
        || metadata.packageHash !== actualPackageHash
        || workerPackage.provenance.runId !== runId
        || activation.protocol !== WORKER_PROTOCOL
        || activation.taskId !== taskId
        || activation.runId !== runId
        || typeof activation.packageHash !== "string"
        || activation.packageHash !== actualPackageHash
        || typeof activation.activatedAt !== "string") {
        throw new Error(`Worker run ${runId} activation or package binding is malformed.`);
    }
    return {
        taskId,
        runId,
        owner: metadata.owner,
        role: workerPackage.role,
        packageHash: actualPackageHash,
        workerPackage,
        activation: activation,
    };
}
