import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  listAgents,
  readRunLog,
  type RegisteredAgent,
  type RunLogEvent,
} from "../agents/index.js";
import {
  captureTaskCompletionCandidate,
} from "./gate.js";
import {
  compareTaskEvidenceFreshness,
  readTaskEvidence,
  type TaskEvidenceCandidateSubject,
  type TaskEvidenceFreshness,
  type TaskEvidenceRecord,
  type TaskEvidenceSubject,
} from "./evidence.js";

const execFileAsync = promisify(execFile);
const MAX_COMMITS = 64;
const MAX_DIFF_FILES = 256;
const MAX_RUNS = 128;

export interface TaskProvenanceBaseline {
  baselineId: string;
  repository: "git" | "none";
  headSha?: string;
  time: string;
  taskFile: string;
  dirtyFiles: string[];
  bookkeepingPaths: string[];
}

export interface TaskProvenanceCommit {
  sha: string;
  time: string;
  author: string;
  subject: string;
}

export interface TaskProvenanceDiffFile {
  status: string;
  path: string;
}

export interface TaskProvenanceRun {
  time: string;
  event: RunLogEvent["event"];
  runId?: string;
  task?: string;
  agent: string;
  developer: string;
  platform: string;
  model: string;
  state?: RunLogEvent["state"];
  durationSec?: number;
  outcome: RunLogEvent["outcome"];
  reason?: string;
}

export interface TaskProvenanceParticipant {
  agent: string;
  developer: string;
  platform: string;
  model: string;
  runIds: string[];
  evidenceIds: string[];
}

export interface TaskProvenanceEvidence extends TaskEvidenceRecord {
  freshness: TaskEvidenceFreshness;
  freshnessReason: string;
  freshnessAtDecision: TaskEvidenceFreshness | "not-selected";
  supersededBy: string[];
}

export interface TaskProvenanceCompletion {
  evidenceId: string;
  runId: string;
  time: string;
  result: TaskEvidenceRecord["result"];
  subject: TaskEvidenceSubject;
  evidenceSet: string[];
  currentFreshness: TaskEvidenceFreshness;
  currentFreshnessReason: string;
}

export interface TaskProvenance {
  taskId: string;
  taskPath: string;
  currentSubject: TaskEvidenceCandidateSubject;
  changedFiles: string[];
  baseline?: TaskProvenanceBaseline;
  commits: TaskProvenanceCommit[];
  diffFiles: TaskProvenanceDiffFile[];
  participants: TaskProvenanceParticipant[];
  runs: TaskProvenanceRun[];
  evidence: TaskProvenanceEvidence[];
  completion?: TaskProvenanceCompletion;
  diagnostics: string[];
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function capText(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function provenanceRun(event: RunLogEvent): TaskProvenanceRun {
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

async function gitLines(rootDirectory: string, args: string[]): Promise<string[] | undefined> {
  try {
    const result = await execFileAsync("git", args, {
      cwd: rootDirectory,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    });
    return result.stdout.split(/\r?\n/).filter((line) => line.length > 0);
  } catch {
    return undefined;
  }
}

function parseCommits(lines: readonly string[] | undefined): TaskProvenanceCommit[] {
  if (!lines) return [];
  return lines.slice(0, MAX_COMMITS).flatMap((line) => {
    const [sha, time, author, ...subjectParts] = line.split("\t");
    if (!sha || !time || !author || subjectParts.length === 0) return [];
    return [{
      sha: capText(sha, 160),
      time: capText(time, 40),
      author: capText(author, 160),
      subject: capText(subjectParts.join("\t"), 240),
    }];
  });
}

function parseDiff(lines: readonly string[] | undefined): TaskProvenanceDiffFile[] {
  if (!lines) return [];
  const files = lines.flatMap((line) => {
    const parts = line.split("\t");
    if (parts.length < 2) return [];
    return [{ status: capText(parts[0], 20), path: normalizePath(capText(parts.slice(1).join(" -> "), 320)) }];
  });
  const unique = new Map<string, TaskProvenanceDiffFile>();
  for (const file of files) unique.set(`${file.status}:${file.path}`, file);
  return [...unique.values()].sort((left, right) => left.path.localeCompare(right.path) || left.status.localeCompare(right.status)).slice(0, MAX_DIFF_FILES);
}

function parseStatus(lines: readonly string[] | undefined): TaskProvenanceDiffFile[] {
  if (!lines) return [];
  return lines.flatMap((line) => {
    if (line.length < 4) return [];
    return [{ status: capText(line.slice(0, 2), 20), path: normalizePath(capText(line.slice(3), 320)) }];
  });
}

function evidenceKey(record: TaskEvidenceRecord): string {
  if (record.type === "completion") return "completion";
  return `${record.type}:${record.checkId ?? ""}`;
}

function completionRecord(records: readonly TaskEvidenceRecord[]): TaskEvidenceRecord | undefined {
  return [...records].reverse().find((record) => record.type === "completion");
}

function evidenceWithProvenance(
  records: readonly TaskEvidenceRecord[],
  currentSubject: TaskEvidenceCandidateSubject,
  completion: TaskEvidenceRecord | undefined,
): TaskProvenanceEvidence[] {
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

function participantRecords(
  agents: readonly RegisteredAgent[],
  runs: readonly TaskProvenanceRun[],
  evidence: readonly TaskProvenanceEvidence[],
): TaskProvenanceParticipant[] {
  const ids = new Set([
    ...runs.map((run) => run.agent),
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
        ...runs.filter((run) => run.agent === agentId && run.runId).map((run) => run.runId!),
        ...evidence.filter((record) => record.agent === agentId).map((record) => record.runId),
      ])].sort(),
      evidenceIds: evidence.filter((record) => record.agent === agentId).map((record) => record.id),
    };
  });
}

function renderBaseline(baseline: TaskProvenanceBaseline | undefined): string {
  if (!baseline) return "Baseline: none";
  return [
    `Baseline: ${baseline.baselineId}`,
    `Baseline HEAD: ${baseline.headSha ?? "none"}`,
    `Baseline repository: ${baseline.repository}`,
    `Baseline dirty files: ${baseline.dirtyFiles.length}`,
  ].join("\n");
}

export async function buildTaskProvenance(
  rootDirectory: string,
  taskDirectory: string,
  taskId: string,
): Promise<TaskProvenance> {
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
  const runIds = new Set(runs.map((run) => run.runId).filter((runId): runId is string => Boolean(runId)));
  const syntheticRuns = evidence
    .filter((record) => !runIds.has(record.runId))
    .map((record): TaskProvenanceRun => ({
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
  const diagnostics: string[] = [];
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
  const uniqueDiffFiles = new Map<string, TaskProvenanceDiffFile>();
  for (const file of allDiffFiles) uniqueDiffFiles.set(`${file.status}:${file.path}`, file);
  if (!statusLines && !diffLines) diagnostics.push("Git diff/status unavailable; non-code provenance is retained without commit details.");
  const completionFreshness = completion
    ? compareTaskEvidenceFreshness(completion, candidate.subject)
    : undefined;
  const agents = await listAgents(rootDirectory);

  return {
    taskId,
    taskPath: candidate.taskPath.replace(/\\/g, "/"),
    currentSubject: candidate.subject,
    changedFiles: [...candidate.changedFiles].sort(),
    ...(baseline ? { baseline } : {}),
    commits,
    diffFiles: [...uniqueDiffFiles.values()]
      .sort((left, right) => left.path.localeCompare(right.path) || left.status.localeCompare(right.status))
      .slice(0, MAX_DIFF_FILES),
    participants: participantRecords(agents, allRuns, evidence),
    runs: allRuns,
    evidence,
    ...(completion && completionFreshness ? {
      completion: {
        evidenceId: completion.id,
        runId: completion.runId,
        time: completion.time,
        result: completion.result,
        subject: completion.subject as TaskEvidenceSubject,
        evidenceSet: [...(completion.evidenceSet ?? [])],
        currentFreshness: completionFreshness.freshness,
        currentFreshnessReason: completionFreshness.reason,
      },
    } : {}),
    diagnostics,
  };
}

export function renderTaskProvenance(provenance: TaskProvenance): string {
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
    "Commits:",
    ...(provenance.commits.length > 0
      ? provenance.commits.map((commit) => `  - ${commit.sha} ${commit.time} ${commit.author}: ${commit.subject}`)
      : ["  - none" ]),
    "Diff files:",
    ...(provenance.diffFiles.length > 0
      ? provenance.diffFiles.map((file) => `  - ${file.status} ${file.path}`)
      : ["  - none"]),
    "Runs:",
    ...(provenance.runs.length > 0
      ? provenance.runs.map((run) => `  - ${run.time} ${run.event}${run.runId ? ` ${run.runId}` : ""} agent=${run.agent} ${run.platform}/${run.model} outcome=${run.outcome}`)
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
