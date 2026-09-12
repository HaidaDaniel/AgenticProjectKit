import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { listAgents, readRunLog, } from "../agents/index.js";
import { captureTaskCompletionCandidate, } from "./gate.js";
import { compareTaskEvidenceFreshness, readTaskEvidence, } from "./evidence.js";
import { isSafeRunId } from "../work/contract.js";
import { readActiveWorkerSession } from "../work/session.js";
import { listWorkspaceStatuses } from "../workspaces/index.js";
const execFileAsync = promisify(execFile);
const MAX_COMMITS = 64;
const MAX_DIFF_FILES = 256;
const MAX_RUNS = 128;
const MAX_WORKER_RUNS = 128;
function normalizePath(path) {
    return path.replace(/\\/g, "/").replace(/^\.\//, "");
}
function capText(value, maxLength) {
    return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}
function provenanceRun(event) {
    return {
        time: event.time,
        event: event.event,
        ...(event.runId ? { runId: event.runId } : {}),
        ...(event.task ? { task: event.task } : {}),
        agent: event.agent,
        developer: event.developer,
        platform: event.platform,
        model: event.model,
        ...(event.state ? { state: event.state } : {}),
        ...(event.durationSec === undefined ? {} : { durationSec: event.durationSec }),
        outcome: event.outcome,
        ...(event.reason ? { reason: event.reason } : {}),
    };
}
async function gitLines(rootDirectory, args) {
    try {
        const result = await execFileAsync("git", args, {
            cwd: rootDirectory,
            maxBuffer: 2 * 1024 * 1024,
            windowsHide: true,
        });
        return result.stdout.split(/\r?\n/).filter((line) => line.length > 0);
    }
    catch {
        return undefined;
    }
}
function parseCommits(lines) {
    if (!lines)
        return [];
    return lines.slice(0, MAX_COMMITS).flatMap((line) => {
        const [sha, time, author, ...subjectParts] = line.split("\t");
        if (!sha || !time || !author || subjectParts.length === 0)
            return [];
        return [{
                sha: capText(sha, 160),
                time: capText(time, 40),
                author: capText(author, 160),
                subject: capText(subjectParts.join("\t"), 240),
            }];
    });
}
function parseDiff(lines) {
    if (!lines)
        return [];
    const files = lines.flatMap((line) => {
        const parts = line.split("\t");
        if (parts.length < 2)
            return [];
        return [{ status: capText(parts[0], 20), path: normalizePath(capText(parts.slice(1).join(" -> "), 320)) }];
    });
    const unique = new Map();
    for (const file of files)
        unique.set(`${file.status}:${file.path}`, file);
    return [...unique.values()].sort((left, right) => left.path.localeCompare(right.path) || left.status.localeCompare(right.status)).slice(0, MAX_DIFF_FILES);
}
function parseStatus(lines) {
    if (!lines)
        return [];
    return lines.flatMap((line) => {
        if (line.length < 4)
            return [];
        return [{ status: capText(line.slice(0, 2), 20), path: normalizePath(capText(line.slice(3), 320)) }];
    });
}
function evidenceKey(record) {
    if (record.type === "completion")
        return "completion";
    return `${record.type}:${record.checkId ?? ""}`;
}
function completionRecord(records) {
    return [...records].reverse().find((record) => record.type === "completion");
}
function evidenceWithProvenance(records, currentSubject, completion) {
    return records.map((record, index) => {
        const freshness = compareTaskEvidenceFreshness(record, currentSubject);
        const supersededBy = records
            .slice(index + 1)
            .filter((later) => evidenceKey(later) === evidenceKey(record) && later.subject.candidateId !== record.subject.candidateId)
            .map((later) => later.id);
        const decisionFreshness = completion?.evidenceSet?.includes(record.id)
            ? compareTaskEvidenceFreshness(record, completion.subject)
            : undefined;
        return {
            ...record,
            freshness: freshness.freshness,
            freshnessReason: freshness.reason,
            freshnessAtDecision: decisionFreshness?.freshness ?? "not-selected",
            supersededBy,
        };
    });
}
function workerSubject(value, taskId) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return undefined;
    const raw = value;
    if ((raw.taskId !== undefined && raw.taskId !== taskId)
        || (raw.repository !== "git" && raw.repository !== "none")
        || typeof raw.baselineId !== "string"
        || typeof raw.candidateId !== "string"
        || typeof raw.worktreeId !== "string"
        || (raw.headSha !== undefined && typeof raw.headSha !== "string"))
        return undefined;
    return {
        taskId,
        repository: raw.repository,
        ...(raw.headSha === undefined ? {} : { headSha: raw.headSha }),
        baselineId: raw.baselineId,
        candidateId: raw.candidateId,
        worktreeId: raw.worktreeId,
    };
}
function workerStatus(record) {
    if (!record)
        return "pending";
    if (record.workerStatus === "completed")
        return "completed";
    if (record.workerStatus === "changes_requested")
        return "changes_requested";
    if (record.workerStatus === "failed")
        return "failed";
    if (record.result === "pass")
        return "completed";
    if (record.result === "changes_requested")
        return "changes_requested";
    return "failed";
}
async function readWorkerRuns(rootDirectory, taskId, records, diagnostics) {
    const taskDirectory = join(rootDirectory, ".agentic/sessions/work", taskId);
    let entries;
    try {
        entries = (await readdir(taskDirectory, { withFileTypes: true }))
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort();
    }
    catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
            return [];
        diagnostics.push(`Worker-run provenance unavailable for ${taskId}: ${error instanceof Error ? error.message : String(error)}.`);
        return [];
    }
    if (entries.length > MAX_WORKER_RUNS) {
        diagnostics.push(`Worker-run provenance truncated at ${MAX_WORKER_RUNS} runs for ${taskId}.`);
    }
    const workerRuns = [];
    for (const runId of entries.slice(0, MAX_WORKER_RUNS)) {
        if (!isSafeRunId(runId)) {
            diagnostics.push(`Worker-run provenance ignored unsafe run directory ${taskId}/${runId}.`);
            continue;
        }
        let raw;
        try {
            const value = JSON.parse(await readFile(join(taskDirectory, runId, "metadata.json"), "utf8"));
            if (!value || typeof value !== "object" || Array.isArray(value))
                throw new Error("metadata is not an object");
            raw = value;
        }
        catch (error) {
            diagnostics.push(`Worker-run provenance ignored malformed metadata for ${taskId}/${runId}: ${error instanceof Error ? error.message : String(error)}.`);
            continue;
        }
        const issuedSubject = workerSubject(raw.issuedSubject, taskId);
        if (raw.protocol !== "apk-worker-v1"
            || raw.taskId !== taskId
            || raw.runId !== runId
            || typeof raw.owner !== "string"
            || typeof raw.role !== "string"
            || issuedSubject === undefined) {
            diagnostics.push(`Worker-run provenance ignored malformed metadata identity for ${taskId}/${runId}.`);
            continue;
        }
        const evidence = [...records].reverse().find((record) => (record.runId === runId
            && (record.workerProtocol === "apk-worker-v1" || record.type === "review")));
        let activated = false;
        try {
            await readActiveWorkerSession(rootDirectory, taskId, runId);
            activated = true;
        }
        catch (error) {
            diagnostics.push(`Worker run ${taskId}/${runId} is unactivated: ${error instanceof Error ? error.message : String(error)}.`);
        }
        const outputSubject = evidence ? workerSubject(evidence.subject, taskId) : undefined;
        if (evidence && outputSubject === undefined) {
            diagnostics.push(`Worker-run provenance found malformed output subject for ${taskId}/${runId}.`);
        }
        if (!evidence) {
            diagnostics.push(`Worker run ${taskId}/${runId} has no matching evidence; status is pending.`);
        }
        workerRuns.push({
            runId,
            role: raw.role,
            agent: evidence?.agent ?? raw.owner,
            activated,
            issuedSubject,
            ...(outputSubject ? { outputSubject } : {}),
            status: activated ? workerStatus(evidence) : "unactivated",
            ...(evidence ? { evidenceId: evidence.id } : {}),
        });
    }
    return workerRuns;
}
function participantRecords(agents, runs, workerRuns, evidence) {
    const ids = new Set([
        ...runs.map((run) => run.agent),
        ...workerRuns.map((run) => run.agent),
        ...evidence.map((record) => record.agent),
    ]);
    const agentMap = new Map(agents.map((agent) => [agent.id, agent]));
    return [...ids].sort().map((agentId) => {
        const agent = agentMap.get(agentId);
        return {
            agent: agentId,
            developer: agent?.developer ?? "unknown",
            platform: agent?.platform ?? "unknown",
            model: agent?.model ?? "unknown",
            runIds: [...new Set([
                    ...runs.filter((run) => run.agent === agentId && run.runId).map((run) => run.runId),
                    ...workerRuns.filter((run) => run.agent === agentId).map((run) => run.runId),
                    ...evidence.filter((record) => record.agent === agentId).map((record) => record.runId),
                ])].sort(),
            evidenceIds: evidence.filter((record) => record.agent === agentId).map((record) => record.id),
        };
    });
}
function renderBaseline(baseline) {
    if (!baseline)
        return "Baseline: none";
    return [
        `Baseline: ${baseline.baselineId}`,
        `Baseline HEAD: ${baseline.headSha ?? "none"}`,
        `Baseline repository: ${baseline.repository}`,
        `Baseline dirty files: ${baseline.dirtyFiles.length}`,
    ].join("\n");
}
export async function buildTaskProvenance(rootDirectory, taskDirectory, taskId) {
    const candidate = await captureTaskCompletionCandidate({
        rootDirectory,
        taskDirectory,
        taskId,
    });
    const records = await readTaskEvidence(rootDirectory, taskId);
    const completion = completionRecord(records);
    const evidence = evidenceWithProvenance(records, candidate.subject, completion);
    const rawRuns = (await readRunLog(rootDirectory)).filter((run) => run.task === taskId);
    const runs = rawRuns.slice(-MAX_RUNS).map(provenanceRun);
    const runIds = new Set(runs.map((run) => run.runId).filter((runId) => Boolean(runId)));
    const syntheticRuns = evidence
        .filter((record) => !runIds.has(record.runId))
        .map((record) => ({
        time: record.time,
        event: record.type === "review" ? "review" : record.type === "completion" ? "done" : record.type === "dogfood" ? "work" : "verify",
        runId: record.runId,
        task: record.taskId,
        agent: record.agent,
        developer: "unknown",
        platform: "unknown",
        model: "unknown",
        outcome: record.result === "pass" ? "ok" : "error",
        reason: `evidence ${record.type}`,
    }));
    const allRuns = [...runs, ...syntheticRuns]
        .sort((left, right) => left.time.localeCompare(right.time) || left.runId?.localeCompare(right.runId ?? "") || 0)
        .slice(-MAX_RUNS);
    const baseline = candidate.baseline
        ? {
            baselineId: candidate.baseline.baselineId,
            repository: candidate.baseline.repository,
            ...(candidate.baseline.headSha ? { headSha: candidate.baseline.headSha } : {}),
            time: candidate.baseline.time,
            taskFile: candidate.baseline.taskFile,
            dirtyFiles: Object.keys(candidate.baseline.dirtyFiles).sort(),
            bookkeepingPaths: [...candidate.baseline.bookkeepingPaths].sort(),
        }
        : undefined;
    const diagnostics = [...candidate.diagnostics];
    const workerRuns = await readWorkerRuns(rootDirectory, taskId, records, diagnostics);
    let workspaces = [];
    try {
        workspaces = (await listWorkspaceStatuses(rootDirectory)).filter((workspace) => workspace.taskId === taskId);
    }
    catch (error) {
        diagnostics.push(`Workspace provenance unavailable for ${taskId}: ${error instanceof Error ? error.message : String(error)}.`);
    }
    const commits = baseline?.headSha
        ? parseCommits(await gitLines(rootDirectory, ["log", "--no-decorate", "--format=%H%x09%aI%x09%an%x09%s", `--max-count=${MAX_COMMITS}`, `${baseline.headSha}..HEAD`]))
        : [];
    if (!baseline?.headSha) {
        diagnostics.push("No baseline HEAD is available; commit range is unavailable.");
    }
    const diffLines = baseline?.headSha
        ? [
            ...(await gitLines(rootDirectory, ["diff", "--name-status", "--no-renames", baseline.headSha]) ?? []),
            ...(await gitLines(rootDirectory, ["diff", "--cached", "--name-status", "--no-renames", baseline.headSha]) ?? []),
        ]
        : undefined;
    const statusLines = await gitLines(rootDirectory, ["status", "--short", "--untracked-files=all"]);
    const diffFiles = parseDiff(diffLines);
    const allDiffFiles = [...diffFiles, ...parseStatus(statusLines)];
    const uniqueDiffFiles = new Map();
    for (const file of allDiffFiles)
        uniqueDiffFiles.set(`${file.status}:${file.path}`, file);
    if (!statusLines && !diffLines)
        diagnostics.push("Git diff/status unavailable; non-code provenance is retained without commit details.");
    const completionFreshness = completion
        ? compareTaskEvidenceFreshness(completion, candidate.subject)
        : undefined;
    const agents = await listAgents(rootDirectory);
    const repositoryActivity = {
        commits,
        diffFiles: [...uniqueDiffFiles.values()]
            .sort((left, right) => left.path.localeCompare(right.path) || left.status.localeCompare(right.status))
            .slice(0, MAX_DIFF_FILES),
    };
    const taskAttributedFiles = candidate.changedFiles
        .filter((file) => !candidate.scope.outOfScopeFiles.includes(file))
        .filter((file) => !candidate.scope.forbiddenTouchedFiles.includes(file))
        .sort();
    return {
        taskId,
        taskPath: candidate.taskPath.replace(/\\/g, "/"),
        currentSubject: candidate.subject,
        changedFiles: [...candidate.changedFiles].sort(),
        ...(baseline ? { baseline } : {}),
        taskAttributedFiles,
        repositoryActivity,
        commits: repositoryActivity.commits,
        diffFiles: repositoryActivity.diffFiles,
        participants: participantRecords(agents, allRuns, workerRuns, evidence),
        runs: allRuns,
        workerRuns,
        workspaces,
        evidence,
        ...(completion && completionFreshness ? {
            completion: {
                evidenceId: completion.id,
                runId: completion.runId,
                time: completion.time,
                result: completion.result,
                subject: completion.subject,
                evidenceSet: [...(completion.evidenceSet ?? [])],
                currentFreshness: completionFreshness.freshness,
                currentFreshnessReason: completionFreshness.reason,
            },
        } : {}),
        diagnostics,
    };
}
export function renderTaskProvenance(provenance) {
    const lines = [
        `Task: ${provenance.taskId}`,
        `Task path: ${provenance.taskPath}`,
        `Current candidate: ${provenance.currentSubject.candidateId}`,
        `Current worktree: ${provenance.currentSubject.worktreeId}`,
        renderBaseline(provenance.baseline),
        `Changed files: ${provenance.changedFiles.length > 0 ? provenance.changedFiles.join(", ") : "none"}`,
        "Participants:",
        ...(provenance.participants.length > 0
            ? provenance.participants.map((participant) => `  - ${participant.agent} (${participant.platform}/${participant.model}; runs=${participant.runIds.length}; evidence=${participant.evidenceIds.length})`)
            : ["  - none"]),
        "Task-attributed changed files:",
        ...(provenance.taskAttributedFiles.length > 0
            ? provenance.taskAttributedFiles.map((file) => `  - ${file}`)
            : ["  - none"]),
        "Repository activity since task baseline:",
        ...(provenance.repositoryActivity.commits.length > 0
            ? provenance.repositoryActivity.commits.map((commit) => `  - ${commit.sha} ${commit.time} ${commit.author}: ${commit.subject}`)
            : ["  - none"]),
        "Repository diff files:",
        ...(provenance.repositoryActivity.diffFiles.length > 0
            ? provenance.repositoryActivity.diffFiles.map((file) => `  - ${file.status} ${file.path}`)
            : ["  - none"]),
        "Runs:",
        ...(provenance.runs.length > 0
            ? provenance.runs.map((run) => `  - ${run.time} ${run.event}${run.runId ? ` ${run.runId}` : ""} agent=${run.agent} ${run.platform}/${run.model} outcome=${run.outcome}`)
            : ["  - none"]),
        "Worker runs:",
        ...(provenance.workerRuns.length > 0
            ? provenance.workerRuns.map((run) => `  - ${run.runId} ${run.role}: ${run.issuedSubject.candidateId} -> ${run.outputSubject?.candidateId ?? "pending"} activated=${run.activated} status=${run.status}${run.evidenceId ? ` evidence=${run.evidenceId}` : ""}`)
            : ["  - none"]),
        "Workspaces:",
        ...(provenance.workspaces.length > 0
            ? provenance.workspaces.map((workspace) => `  - ${workspace.id} state=${workspace.state} cleanup=${workspace.safeToCleanup ? "safe" : "blocked"} worktree=${workspace.worktreeId.slice(0, 16)}${workspace.runId ? ` run=${workspace.runId}` : ""}`)
            : ["  - none"]),
        "Evidence:",
        ...(provenance.evidence.length > 0
            ? provenance.evidence.map((record) => `  - ${record.id} ${record.type}=${record.result} run=${record.runId} freshness=${record.freshness} at-decision=${record.freshnessAtDecision}${record.supersededBy.length > 0 ? ` superseded-by=${record.supersededBy.join(",")}` : ""}`)
            : ["  - none"]),
        `Completion: ${provenance.completion ? `${provenance.completion.evidenceId} freshness=${provenance.completion.currentFreshness} evidence-set=${provenance.completion.evidenceSet.join(",") || "none"}` : "none"}`,
    ];
    if (provenance.diagnostics.length > 0) {
        lines.push("Diagnostics:", ...provenance.diagnostics.map((diagnostic) => `  - ${diagnostic}`));
    }
    lines.push("");
    return lines.join("\n");
}
