import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { withLocalMutationLock } from "../tasks/lock.js";

import {
  parseWorkerPackage,
  serializeWorkerPackage,
  validateWorkerRunId,
  WORKER_PROTOCOL,
  type WorkerPackage,
  type WorkerRole,
} from "./contract.js";

export const WORK_SESSION_DIRECTORY = ".agentic/sessions/work";

export interface WorkerRunActivation {
  protocol: typeof WORKER_PROTOCOL;
  taskId: string;
  runId: string;
  packageHash: string;
  activatedAt: string;
}

export interface ActiveWorkerSession {
  taskId: string;
  runId: string;
  owner: string;
  role: WorkerRole;
  packageHash: string;
  workerPackage: WorkerPackage;
  activation: WorkerRunActivation;
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sessionDirectory(rootDirectory: string, taskId: string, runId: string): string {
  return join(rootDirectory, WORK_SESSION_DIRECTORY, taskId, runId);
}

export async function withWorkerReviewLifecycleLock<T>(
  rootDirectory: string,
  taskId: string,
  runId: string,
  run: () => Promise<T>,
): Promise<T> {
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

export async function readActiveWorkerSession(
  rootDirectory: string,
  taskId: string,
  runId: string,
): Promise<ActiveWorkerSession> {
  validateWorkerRunId(runId);
  const directory = sessionDirectory(rootDirectory, taskId, runId);
  let packageValue: string;
  let metadataValue: string;
  try {
    [packageValue, metadataValue] = await Promise.all([
      readFile(join(directory, "package.json"), "utf8"),
      readFile(join(directory, "metadata.json"), "utf8"),
    ]);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Worker run ${runId} session is incomplete for task ${taskId}.`);
    }
    throw error;
  }

  let activationValue: string;
  try {
    activationValue = await readFile(join(directory, "activation.json"), "utf8");
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Worker run ${runId} is not activated for task ${taskId}.`);
    }
    throw error;
  }

  let metadata: Record<string, unknown>;
  let activation: Partial<WorkerRunActivation>;
  try {
    const parsedMetadata: unknown = JSON.parse(metadataValue);
    const parsedActivation: unknown = JSON.parse(activationValue);
    if (!parsedMetadata || typeof parsedMetadata !== "object" || Array.isArray(parsedMetadata)) {
      throw new Error("metadata is not an object");
    }
    if (!parsedActivation || typeof parsedActivation !== "object" || Array.isArray(parsedActivation)) {
      throw new Error("activation is not an object");
    }
    metadata = parsedMetadata as Record<string, unknown>;
    activation = parsedActivation as Partial<WorkerRunActivation>;
  } catch (error: unknown) {
    throw new Error(`Worker run ${runId} session metadata is malformed: ${error instanceof Error ? error.message : String(error)}.`);
  }

  const workerPackage = parseWorkerPackage(packageValue);
  const actualPackageHash = hashText(serializeWorkerPackage(workerPackage));
  if (
    metadata.protocol !== WORKER_PROTOCOL
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
    || typeof activation.activatedAt !== "string"
  ) {
    throw new Error(`Worker run ${runId} activation or package binding is malformed.`);
  }

  return {
    taskId,
    runId,
    owner: metadata.owner,
    role: workerPackage.role,
    packageHash: actualPackageHash,
    workerPackage,
    activation: activation as WorkerRunActivation,
  };
}
