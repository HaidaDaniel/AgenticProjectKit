export const WORKER_PROTOCOL = "apk-worker-v1";
export const WORKER_ROLES = ["implement", "review", "fix", "verify"];
export const WORKER_STATUSES = ["completed", "failed", "changes_requested"];
export const SAFE_RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
export function isSafeRunId(value) {
    return SAFE_RUN_ID_PATTERN.test(value);
}
export class WorkerContractError extends Error {
    constructor(message) {
        super(message);
        this.name = "WorkerContractError";
    }
}
export function validateWorkerRunId(value) {
    if (!isSafeRunId(value)) {
        throw new WorkerContractError("worker run id must be a compact identifier.");
    }
    return value;
}
function text(value, label, maxLength = 320) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new WorkerContractError(`${label} must be a non-empty string.`);
    }
    if (value.includes("\n") || value.includes("\r")) {
        throw new WorkerContractError(`${label} must be single-line.`);
    }
    if (value.length > maxLength) {
        throw new WorkerContractError(`${label} must be at most ${maxLength} characters.`);
    }
    return value;
}
function optionalText(value, label, maxLength = 320) {
    return value === undefined ? undefined : text(value, label, maxLength);
}
function boundedList(value, label, maxItems = 64, maxItemLength = 320) {
    if (!Array.isArray(value)) {
        throw new WorkerContractError(`${label} must be an array.`);
    }
    if (value.length > maxItems) {
        throw new WorkerContractError(`${label} must contain at most ${maxItems} items.`);
    }
    return value.map((item, index) => text(item, `${label}[${index}]`, maxItemLength));
}
function optionalBoundedList(value, label, maxItems = 64, maxItemLength = 320) {
    return value === undefined ? undefined : boundedList(value, label, maxItems, maxItemLength);
}
function objectValue(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new WorkerContractError(`${label} must be an object.`);
    }
    return value;
}
function workerRole(value, label) {
    if (WORKER_ROLES.includes(value)) {
        return value;
    }
    throw new WorkerContractError(`${label} must be one of: ${WORKER_ROLES.join(", ")}.`);
}
function workerStatus(value, label) {
    if (WORKER_STATUSES.includes(value)) {
        return value;
    }
    throw new WorkerContractError(`${label} must be one of: ${WORKER_STATUSES.join(", ")}.`);
}
function requiredNumber(value, label, max = 1_000_000) {
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0 || value > max) {
        throw new WorkerContractError(`${label} must be a positive integer at most ${max}.`);
    }
    return value;
}
function optionalNumber(value, label, max = 1_000_000) {
    return value === undefined ? undefined : requiredNumber(value, label, max);
}
function parsePackage(value) {
    const raw = objectValue(value, "worker package");
    if (raw.protocol !== WORKER_PROTOCOL) {
        throw new WorkerContractError(`worker package.protocol must be ${WORKER_PROTOCOL}.`);
    }
    const task = objectValue(raw.task, "worker package.task");
    const context = objectValue(raw.context, "worker package.context");
    const constraints = objectValue(raw.constraints, "worker package.constraints");
    const expectations = objectValue(raw.outputExpectations, "worker package.outputExpectations");
    const provenance = objectValue(raw.provenance, "worker package.provenance");
    const diagnostics = optionalBoundedList(context.diagnostics, "worker package.context.diagnostics", 16);
    const packageValue = {
        protocol: WORKER_PROTOCOL,
        task: {
            id: text(task.id, "worker package.task.id", 120),
            title: text(task.title, "worker package.task.title"),
            goal: text(task.goal, "worker package.task.goal"),
        },
        role: workerRole(raw.role, "worker package.role"),
        context: {
            level: context.level === 1 || context.level === 2 || context.level === 3
                ? context.level
                : (() => { throw new WorkerContractError("worker package.context.level must be 1, 2, or 3."); })(),
            files: boundedList(context.files, "worker package.context.files"),
            ...(optionalNumber(context.budget, "worker package.context.budget") === undefined ? {} : { budget: context.budget }),
            ...(optionalNumber(context.estimatedUnits, "worker package.context.estimatedUnits") === undefined ? {} : { estimatedUnits: context.estimatedUnits }),
            ...(diagnostics === undefined ? {} : { diagnostics }),
        },
        constraints: {
            allowedFiles: boundedList(constraints.allowedFiles, "worker package.constraints.allowedFiles"),
            forbiddenFiles: boundedList(constraints.forbiddenFiles, "worker package.constraints.forbiddenFiles"),
            acceptanceCriteria: boundedList(constraints.acceptanceCriteria, "worker package.constraints.acceptanceCriteria"),
            verification: boundedList(constraints.verification, "worker package.constraints.verification"),
        },
        outputExpectations: {
            requiredFields: boundedList(expectations.requiredFields, "worker package.outputExpectations.requiredFields", 16, 120),
            evidence: boundedList(expectations.evidence, "worker package.outputExpectations.evidence", 16),
            reviewFindings: expectations.reviewFindings === true,
            reason: expectations.reason === true,
        },
        ...(raw.review === undefined ? {} : { review: parseReviewBinding(raw.review) }),
        ...(raw.handoff === undefined ? {} : { handoff: parseHandoff(raw.handoff) }),
        provenance: {
            runId: validateWorkerRunId(text(provenance.runId, "worker package.provenance.runId", 120)),
            ...(optionalText(provenance.resourceId, "worker package.provenance.resourceId", 160) ? { resourceId: provenance.resourceId } : {}),
            ...(provenance.repository === "git" || provenance.repository === "none" ? { repository: provenance.repository } : {}),
            ...(optionalText(provenance.headSha, "worker package.provenance.headSha", 160) ? { headSha: provenance.headSha } : {}),
            ...(optionalText(provenance.baselineId, "worker package.provenance.baselineId", 240) ? { baselineId: provenance.baselineId } : {}),
            ...(optionalText(provenance.candidateId, "worker package.provenance.candidateId", 240) ? { candidateId: provenance.candidateId } : {}),
            ...(optionalText(provenance.worktreeId, "worker package.provenance.worktreeId", 240) ? { worktreeId: provenance.worktreeId } : {}),
        },
    };
    return packageValue;
}
function parseEvidence(value, index) {
    const raw = objectValue(value, `worker result.evidence[${index}]`);
    return {
        id: text(raw.id, `worker result.evidence[${index}].id`, 120),
        type: text(raw.type, `worker result.evidence[${index}].type`, 120),
        result: text(raw.result, `worker result.evidence[${index}].result`, 80),
        ...(optionalText(raw.reference, `worker result.evidence[${index}].reference`) ? { reference: raw.reference } : {}),
    };
}
function parseEvidenceList(value) {
    if (!Array.isArray(value)) {
        throw new WorkerContractError("worker result.evidence must be an array.");
    }
    if (value.length > 64) {
        throw new WorkerContractError("worker result.evidence must contain at most 64 items.");
    }
    return value.map(parseEvidence);
}
function parseHandoff(value) {
    const raw = objectValue(value, "worker package.handoff");
    return {
        fromRunId: validateWorkerRunId(text(raw.fromRunId, "worker package.handoff.fromRunId", 120)),
        fromRole: workerRole(raw.fromRole, "worker package.handoff.fromRole"),
        status: workerStatus(raw.status, "worker package.handoff.status"),
        findings: boundedList(raw.findings, "worker package.handoff.findings", 32),
        ...(optionalText(raw.reason, "worker package.handoff.reason") ? { reason: raw.reason } : {}),
    };
}
function parseReviewBinding(value) {
    const raw = objectValue(value, "worker package.review");
    return {
        reviewRunId: validateWorkerRunId(text(raw.reviewRunId, "worker package.review.reviewRunId", 120)),
        taskId: text(raw.taskId, "worker package.review.taskId", 120),
        reviewer: text(raw.reviewer, "worker package.review.reviewer", 120),
        baselineId: text(raw.baselineId, "worker package.review.baselineId", 240),
        repository: raw.repository === "git" || raw.repository === "none"
            ? raw.repository
            : (() => { throw new WorkerContractError("worker package.review.repository must be git or none."); })(),
        ...(optionalText(raw.headSha, "worker package.review.headSha", 160) ? { headSha: raw.headSha } : {}),
        candidateId: text(raw.candidateId, "worker package.review.candidateId", 240),
        worktreeId: text(raw.worktreeId, "worker package.review.worktreeId", 240),
        changedFiles: boundedList(raw.changedFiles, "worker package.review.changedFiles"),
    };
}
function parseResult(value) {
    const raw = objectValue(value, "worker result");
    if (raw.protocol !== WORKER_PROTOCOL) {
        throw new WorkerContractError(`worker result.protocol must be ${WORKER_PROTOCOL}.`);
    }
    const status = workerStatus(raw.status, "worker result.status");
    const result = {
        protocol: WORKER_PROTOCOL,
        taskId: text(raw.taskId, "worker result.taskId", 120),
        role: workerRole(raw.role, "worker result.role"),
        runId: validateWorkerRunId(text(raw.runId, "worker result.runId", 120)),
        status,
        ...(optionalBoundedList(raw.commitIds, "worker result.commitIds") ? { commitIds: raw.commitIds } : {}),
        ...(optionalText(raw.diffId, "worker result.diffId", 160) ? { diffId: raw.diffId } : {}),
        ...(raw.evidence === undefined ? {} : { evidence: parseEvidenceList(raw.evidence) }),
        ...(optionalBoundedList(raw.reviewFindings, "worker result.reviewFindings", 32) ? { reviewFindings: raw.reviewFindings } : {}),
        ...(optionalText(raw.reason, "worker result.reason") ? { reason: raw.reason } : {}),
    };
    if (status !== "completed" && !result.reason) {
        throw new WorkerContractError(`worker result.reason is required when status is ${status}.`);
    }
    if (raw.provenance !== undefined) {
        const provenance = objectValue(raw.provenance, "worker result.provenance");
        result.provenance = {
            ...(optionalText(provenance.resourceId, "worker result.provenance.resourceId", 160) ? { resourceId: provenance.resourceId } : {}),
            ...(provenance.repository === "git" || provenance.repository === "none" ? { repository: provenance.repository } : {}),
            ...(optionalText(provenance.headSha, "worker result.provenance.headSha", 160) ? { headSha: provenance.headSha } : {}),
            ...(optionalText(provenance.baselineId, "worker result.provenance.baselineId", 240) ? { baselineId: provenance.baselineId } : {}),
            ...(optionalText(provenance.candidateId, "worker result.provenance.candidateId", 240) ? { candidateId: provenance.candidateId } : {}),
            ...(optionalText(provenance.worktreeId, "worker result.provenance.worktreeId", 240) ? { worktreeId: provenance.worktreeId } : {}),
        };
    }
    return result;
}
export function parseWorkerRole(value) {
    return workerRole(value, "worker role");
}
export function parseWorkerStatus(value) {
    return workerStatus(value, "worker status");
}
export function createWorkerPackage(task, context, options) {
    const verification = task.verification
        ? task.verification.map((check) => check.command ?? check.instruction ?? check.id)
        : task.verificationCommands;
    return parsePackage({
        protocol: WORKER_PROTOCOL,
        task: {
            id: task.id,
            title: task.title,
            goal: task.goal,
        },
        role: options.role,
        context: {
            level: context.level,
            files: context.files,
            ...(context.budget === undefined ? {} : { budget: context.budget }),
            ...(context.estimatedUnits === undefined ? {} : { estimatedUnits: context.estimatedUnits }),
            ...(context.diagnostics && context.diagnostics.length > 0
                ? { diagnostics: context.diagnostics.map((diagnostic) => diagnostic.message) }
                : {}),
        },
        constraints: {
            allowedFiles: task.allowedFiles,
            forbiddenFiles: task.forbiddenFiles,
            acceptanceCriteria: task.acceptanceCriteria,
            verification,
        },
        outputExpectations: {
            requiredFields: ["taskId", "role", "runId", "status"],
            evidence: ["evidence references", "subject/provenance identity when available"],
            reviewFindings: options.role === "review",
            reason: true,
        },
        ...(options.review === undefined ? {} : { review: options.review }),
        ...(options.handoff === undefined ? {} : { handoff: options.handoff }),
        provenance: {
            runId: options.runId,
            ...(options.resourceId ? { resourceId: options.resourceId } : {}),
            ...(options.repository ? { repository: options.repository } : {}),
            ...(options.headSha ? { headSha: options.headSha } : {}),
            ...(options.baselineId ? { baselineId: options.baselineId } : {}),
            ...(options.candidateId ? { candidateId: options.candidateId } : {}),
            ...(options.worktreeId ? { worktreeId: options.worktreeId } : {}),
        },
    });
}
export function parseWorkerPackage(value) {
    let parsed = value;
    if (typeof value === "string") {
        try {
            parsed = JSON.parse(value);
        }
        catch (error) {
            throw new WorkerContractError(`worker package must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return parsePackage(parsed);
}
export function serializeWorkerPackage(value) {
    return JSON.stringify(parsePackage(value));
}
export function parseWorkerResult(value) {
    let parsed = value;
    if (typeof value === "string") {
        try {
            parsed = JSON.parse(value);
        }
        catch (error) {
            throw new WorkerContractError(`worker result must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return parseResult(parsed);
}
export function serializeWorkerResult(value) {
    return JSON.stringify(parseResult(value));
}
