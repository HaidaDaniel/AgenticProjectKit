import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import {
  appendRunLog,
  requireAgent,
  type RegisteredAgent,
} from "../agents/index.js";
import {
  appendTaskEvidence,
  readTaskEvidence,
  type TaskEvidenceMetrics,
  type TaskEvidenceRecord,
  type TaskEvidenceCandidateSubject,
} from "./evidence.js";
import {
  captureTaskEvidenceSubject,
  captureTaskScope,
  findTaskFile,
  loadTaskFile,
  readTaskBaseline,
  type ProjectTask,
} from "./index.js";
import { claimTask } from "./workflow.js";

export const DOGFOOD_SESSION_DIRECTORY = ".agentic/sessions/dogfood";
export const DOGFOOD_PROTOCOL_VERSION = "dogfood-v1";

export type DogfoodOutcome = "pass" | "fail";

export interface DogfoodSession {
  sessionId: string;
  taskId: string;
  agent: string;
  tool: string;
  scenario: string;
  taskGoal: string;
  startedAt: string;
  promptPath: string;
  sessionPath: string;
  prompt: string;
}

export interface StartDogfoodOptions {
  rootDirectory: string;
  taskDirectory: string;
  taskId: string;
  owner: string;
  tool: string;
  scenario: string;
  sessionId?: string;
  startedAt?: string;
}

export interface RecordDogfoodOptions {
  rootDirectory: string;
  taskDirectory: string;
  taskId: string;
  owner: string;
  sessionId: string;
  outcome: DogfoodOutcome;
  endedAt?: string;
  failures?: readonly string[];
  retries?: number;
  observations?: readonly string[];
  issues?: readonly string[];
  metrics?: TaskEvidenceMetrics;
}

export interface DogfoodResult {
  session: DogfoodSession;
  outcome: DogfoodOutcome;
  evidence: TaskEvidenceRecord;
}

interface StoredDogfoodSession {
  protocol: string;
  sessionId: string;
  taskId: string;
  agent: string;
  tool: string;
  scenario: string;
  taskGoal: string;
  startedAt: string;
  status: "started" | "completed";
  endedAt?: string;
  outcome?: DogfoodOutcome;
}

function dogfoodRunId(): string {
  return `dogfood-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sessionDirectory(rootDirectory: string, taskId: string, sessionId: string): string {
  return join(rootDirectory, DOGFOOD_SESSION_DIRECTORY, taskId, sessionId);
}

function promptPath(rootDirectory: string, taskId: string, sessionId: string): string {
  return join(sessionDirectory(rootDirectory, taskId, sessionId), "prompt.md");
}

function metadataPath(rootDirectory: string, taskId: string, sessionId: string): string {
  return join(sessionDirectory(rootDirectory, taskId, sessionId), "session.json");
}

function relativePath(rootDirectory: string, path: string): string {
  return relative(rootDirectory, path).replace(/\\/g, "/");
}

function requireSingleLine(value: string, label: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) {
    throw new Error(`${label} must not be empty.`);
  }
  if (normalized.length > maxLength) {
    throw new Error(`${label} must be at most ${maxLength} characters.`);
  }
  return normalized;
}

function requireTimestamp(value: string, label: string): string {
  const normalized = requireSingleLine(value, label, 40);
  if (Number.isNaN(Date.parse(normalized))) {
    throw new Error(`${label} must be an ISO timestamp.`);
  }
  return normalized;
}

function requireSessionId(value: string, label = "sessionId"): string {
  const normalized = requireSingleLine(value, label, 120);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(normalized)) {
    throw new Error(`${label} must be a compact id using lowercase letters, numbers, and dashes.`);
  }
  return normalized;
}

function normalizedList(values: readonly string[] | undefined, label: string): string[] | undefined {
  if (values === undefined) return undefined;
  if (values.length > 16) {
    throw new Error(`${label} must contain at most 16 items.`);
  }
  return values.map((value, index) => requireSingleLine(value, `${label}[${index}]`, 320));
}

function normalizedRetries(value: number | undefined): number {
  if (value === undefined) return 0;
  if (!Number.isInteger(value) || value < 0 || value > 1000) {
    throw new Error("retries must be a non-negative integer at most 1000.");
  }
  return value;
}

function normalizedMetrics(metrics: TaskEvidenceMetrics | undefined): TaskEvidenceMetrics | undefined {
  if (metrics === undefined) return undefined;
  return { ...metrics };
}

function renderList(items: readonly string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ["- none"];
}

export function renderDogfoodPrompt(input: {
  sessionId: string;
  task: ProjectTask;
  agent: RegisteredAgent;
  tool: string;
  scenario: string;
}): string {
  return [
    "Agentic Project Kit dogfood session",
    `Protocol: ${DOGFOOD_PROTOCOL_VERSION}`,
    `Session: ${input.sessionId}`,
    `Agent: ${input.agent.id}`,
    `Developer: ${input.agent.developer}`,
    `Tool: ${input.tool}`,
    `Task: ${input.task.id} - ${input.task.title}`,
    "",
    "Scenario:",
    input.scenario,
    "",
    "Task goal:",
    input.task.goal,
    "",
    "Read first:",
    ...renderList(input.task.contextFiles),
    "",
    "Allowed files:",
    ...renderList(input.task.allowedFiles),
    "",
    "Forbidden files:",
    ...renderList(input.task.forbiddenFiles),
    "",
    "Acceptance criteria:",
    ...renderList(input.task.acceptanceCriteria),
    "",
    "Session rules:",
    "- Follow the scenario through the normal repository workflow.",
    "- Do not launch a model or external service from APK.",
    "- Record a structured pass or fail result after the session.",
    "- Keep failures, observations, and discovered issues concise and bounded.",
    "",
  ].join("\n");
}

export function renderDogfoodSession(session: DogfoodSession): string {
  return [
    `Task: ${session.taskId}`,
    `Session: ${session.sessionId}`,
    `Agent: ${session.agent}`,
    `Tool: ${session.tool}`,
    `Started: ${session.startedAt}`,
    `Prompt: ${session.promptPath}`,
    "",
    session.prompt,
  ].join("\n");
}

async function loadStoredSession(rootDirectory: string, taskId: string, sessionId: string): Promise<StoredDogfoodSession> {
  let raw: string;
  try {
    raw = await readFile(metadataPath(rootDirectory, taskId, sessionId), "utf8");
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Dogfood session not found: ${sessionId}. Start a session first.`);
    }
    throw error;
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error: unknown) {
    throw new Error(`Dogfood session is invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Dogfood session metadata must be a JSON object.");
  }
  const session = value as Partial<StoredDogfoodSession>;
  if (
    session.protocol !== DOGFOOD_PROTOCOL_VERSION ||
    session.sessionId !== sessionId ||
    session.taskId !== taskId ||
    typeof session.agent !== "string" ||
    typeof session.tool !== "string" ||
    typeof session.scenario !== "string" ||
    typeof session.taskGoal !== "string" ||
    typeof session.startedAt !== "string" ||
    (session.status !== "started" && session.status !== "completed")
  ) {
    throw new Error(`Dogfood session metadata is incomplete: ${sessionId}.`);
  }
  return session as StoredDogfoodSession;
}

async function requireNewSession(rootDirectory: string, taskId: string, sessionId: string): Promise<void> {
  try {
    await readFile(metadataPath(rootDirectory, taskId, sessionId), "utf8");
    throw new Error(`Dogfood session already exists: ${sessionId}.`);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === `Dogfood session already exists: ${sessionId}.`) {
      throw error;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

function sessionFromStored(
  rootDirectory: string,
  stored: StoredDogfoodSession,
  prompt: string,
): DogfoodSession {
  return {
    sessionId: stored.sessionId,
    taskId: stored.taskId,
    agent: stored.agent,
    tool: stored.tool,
    scenario: stored.scenario,
    taskGoal: stored.taskGoal,
    startedAt: stored.startedAt,
    promptPath: relativePath(rootDirectory, promptPath(rootDirectory, stored.taskId, stored.sessionId)),
    sessionPath: relativePath(rootDirectory, sessionDirectory(rootDirectory, stored.taskId, stored.sessionId)),
    prompt,
  };
}

export async function startDogfoodSession(options: StartDogfoodOptions): Promise<DogfoodSession> {
  const agent = await requireAgent(options.rootDirectory, options.owner);
  let taskFile = await findTaskFile(options.rootDirectory, options.taskId, options.taskDirectory);
  let { task } = await loadTaskFile(taskFile);

  if (task.state === "todo") {
    task = await claimTask({
      rootDirectory: options.rootDirectory,
      taskDirectory: options.taskDirectory,
      taskId: options.taskId,
      owner: options.owner,
    });
    taskFile = await findTaskFile(options.rootDirectory, options.taskId, options.taskDirectory);
    task = (await loadTaskFile(taskFile)).task;
  } else if ((task.state !== "doing" && task.state !== "review") || task.owner !== options.owner) {
    throw new Error(`Task ${task.id} is ${task.state} owned by ${task.owner}; expected todo or task owned by ${options.owner}.`);
  }

  const tool = requireSingleLine(options.tool, "tool", 120);
  const scenario = requireSingleLine(options.scenario, "scenario", 240);
  const startedAt = requireTimestamp(options.startedAt ?? new Date().toISOString(), "startedAt");
  const sessionId = requireSessionId(options.sessionId ?? dogfoodRunId());
  const taskGoal = requireSingleLine(task.goal, "task goal", 320);
  const prompt = renderDogfoodPrompt({ sessionId, task, agent, tool, scenario });
  const stored: StoredDogfoodSession = {
    protocol: DOGFOOD_PROTOCOL_VERSION,
    sessionId,
    taskId: task.id,
    agent: agent.id,
    tool,
    scenario,
    taskGoal,
    startedAt,
    status: "started",
  };
  await requireNewSession(options.rootDirectory, task.id, sessionId);
  const directory = sessionDirectory(options.rootDirectory, task.id, sessionId);
  await mkdir(directory, { recursive: true });
  await writeFile(promptPath(options.rootDirectory, task.id, sessionId), prompt, "utf8");
  await writeFile(metadataPath(options.rootDirectory, task.id, sessionId), `${JSON.stringify(stored, null, 2)}\n`, "utf8");
  await appendRunLog(options.rootDirectory, {
    event: "work",
    agent,
    task: task.id,
    state: task.state,
    outcome: "ok",
    reason: `dogfood session started (${sessionId})`,
    runId: sessionId,
  });

  return sessionFromStored(options.rootDirectory, stored, prompt);
}

async function dogfoodSubject(
  rootDirectory: string,
  task: ProjectTask,
): Promise<{ subject: TaskEvidenceCandidateSubject; comparisonKnown: boolean }> {
  const baseline = await readTaskBaseline(rootDirectory, task.id);
  const snapshot = await captureTaskScope({ rootDirectory, task, baseline });
  const captured = await captureTaskEvidenceSubject(rootDirectory, task, snapshot.changedFiles);
  return {
    subject: baseline ? { ...captured, baselineId: baseline.baselineId } : captured,
    comparisonKnown: snapshot.comparisonKnown,
  };
}

export async function recordDogfoodResult(options: RecordDogfoodOptions): Promise<DogfoodResult> {
  const agent = await requireAgent(options.rootDirectory, options.owner);
  const sessionId = requireSessionId(options.sessionId);
  const stored = await loadStoredSession(options.rootDirectory, options.taskId, sessionId);
  if (stored.agent !== agent.id || stored.agent !== options.owner) {
    throw new Error(`Dogfood session ${sessionId} belongs to agent ${stored.agent}, not ${options.owner}.`);
  }
  if (stored.status !== "started") {
    throw new Error(`Dogfood session already has a result: ${sessionId}.`);
  }
  if (options.outcome !== "pass" && options.outcome !== "fail") {
    throw new Error("Dogfood outcome must be pass or fail.");
  }

  const endedAt = requireTimestamp(options.endedAt ?? new Date().toISOString(), "endedAt");
  if (Date.parse(endedAt) < Date.parse(stored.startedAt)) {
    throw new Error("endedAt must not precede startedAt.");
  }
  const failures = normalizedList(options.failures, "failures");
  const observations = normalizedList(options.observations, "observations");
  const issues = normalizedList(options.issues, "issues");
  const retries = normalizedRetries(options.retries);
  const metrics = normalizedMetrics(options.metrics);
  const existing = (await readTaskEvidence(options.rootDirectory, options.taskId))
    .find((record) => record.type === "dogfood" && record.runId === sessionId);
  if (existing) {
    throw new Error(`Dogfood session already has evidence: ${sessionId}.`);
  }

  const taskPath = await findTaskFile(options.rootDirectory, options.taskId, options.taskDirectory);
  const task = (await loadTaskFile(taskPath)).task;
  const dogfood = await dogfoodSubject(options.rootDirectory, task);
  const evidence = await appendTaskEvidence(options.rootDirectory, {
    taskId: task.id,
    runId: sessionId,
    agent: agent.id,
    gateEligible: dogfood.comparisonKnown,
    type: "dogfood",
    result: options.outcome,
    subject: dogfood.subject,
    summary: `${options.outcome} dogfood session for ${stored.tool}.`,
    scenario: stored.scenario,
    tool: stored.tool,
    taskGoal: stored.taskGoal,
    startedAt: stored.startedAt,
    endedAt,
    ...(failures === undefined ? {} : { failures }),
    retries,
    ...(observations === undefined ? {} : { observations }),
    ...(issues === undefined ? {} : { issues }),
    ...(metrics === undefined ? {} : { metrics }),
  });

  const completed: StoredDogfoodSession = {
    ...stored,
    status: "completed",
    endedAt,
    outcome: options.outcome,
  };
  await writeFile(
    metadataPath(options.rootDirectory, options.taskId, sessionId),
    `${JSON.stringify(completed, null, 2)}\n`,
    "utf8",
  );
  await appendRunLog(options.rootDirectory, {
    event: "work",
    agent,
    task: task.id,
    state: task.state,
    outcome: options.outcome === "pass" ? "ok" : "error",
    reason: `dogfood session ${options.outcome} (${sessionId})`,
    runId: sessionId,
  });

  const prompt = await readFile(promptPath(options.rootDirectory, options.taskId, sessionId), "utf8");
  return {
    session: sessionFromStored(options.rootDirectory, completed, prompt),
    outcome: options.outcome,
    evidence,
  };
}

export function renderDogfoodResult(result: DogfoodResult): string {
  return [
    `Task: ${result.evidence.taskId}`,
    `Session: ${result.session.sessionId}`,
    `Agent: ${result.evidence.agent}`,
    `Tool: ${result.evidence.tool}`,
    `Outcome: ${result.outcome}`,
    `Evidence: ${result.evidence.id}`,
    `Prompt: ${result.session.promptPath}`,
    "",
  ].join("\n");
}
