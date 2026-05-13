import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import type { TaskState } from "../tasks/index.js";

const execFileAsync = promisify(execFile);

export const AGENTS_PATH = ".agentic/agents.jsonl";
export const RUNS_PATH = ".agentic/runs.jsonl";
export const AGENTS_DIRECTORY = ".agentic/agents";
export const RUNS_DIRECTORY = ".agentic/runs";

export const RUN_EVENTS = [
  "register",
  "claim",
  "release",
  "block",
  "review",
  "done",
  "cancel",
] as const;
export type RunEventType = (typeof RUN_EVENTS)[number];

export interface RegisteredAgent {
  id: string;
  developer: string;
  platform: string;
  model: string;
  label: string;
  created: string;
}

export interface RegisterAgentInput {
  id: string;
  developer?: string;
  platform: string;
  model: string;
  label?: string;
  created?: string;
}

export interface RunLogEvent {
  time: string;
  event: RunEventType;
  task?: string;
  agent: string;
  developer: string;
  platform: string;
  model: string;
  state?: TaskState;
  durationSec?: number;
  outcome: "ok" | "error";
  reason?: string;
}

export interface MigrateLogsResult {
  agentsWritten: string[];
  agentsSkipped: string[];
  runEventsWritten: number;
  runEventsSkipped: number;
  removedLegacy: boolean;
}

const COMPACT_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function isMissingFileError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

async function readJsonlFile<T>(path: string): Promise<T[]> {
  try {
    const text = await readFile(path, "utf8");
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as T);
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

async function readDirectoryFiles(directory: string, suffix: string): Promise<string[]> {
  try {
    return (await readdir(directory))
      .filter((entry) => entry.endsWith(suffix))
      .sort();
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

function validateCompactValue(label: string, value: string): void {
  if (!COMPACT_ID_PATTERN.test(value)) {
    throw new Error(`${label} must be a compact id using lowercase letters, numbers, and dashes.`);
  }
}

export function normalizeDeveloperId(value: string | undefined): string {
  const normalized = (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized.length > 0 ? normalized : "unknown";
}

async function readGitConfig(rootDirectory: string, key: string): Promise<string | undefined> {
  try {
    const result = await execFileAsync("git", ["config", "--get", key], {
      cwd: rootDirectory,
    });
    const value = result.stdout.trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

async function detectDeveloperId(rootDirectory: string, override: string | undefined): Promise<string> {
  if (override !== undefined) {
    const developer = normalizeDeveloperId(override);
    validateCompactValue("Developer", developer);
    return developer;
  }

  const gitEmail = await readGitConfig(rootDirectory, "user.email");
  const gitName = gitEmail ? undefined : await readGitConfig(rootDirectory, "user.name");
  const developer = normalizeDeveloperId(gitEmail ?? gitName);

  validateCompactValue("Developer", developer);
  return developer;
}

function truncateReason(reason: string | undefined): string | undefined {
  if (!reason) {
    return undefined;
  }

  return reason.replace(/\s+/g, " ").trim().slice(0, 160);
}

function canonicalAgent(raw: Partial<RegisteredAgent>): RegisteredAgent {
  return {
    id: raw.id ?? "",
    developer: raw.developer ?? "unknown",
    platform: raw.platform ?? "",
    model: raw.model ?? "",
    label: raw.label ?? raw.id ?? "",
    created: raw.created ?? "",
  };
}

function canonicalRunEvent(
  raw: Partial<RunLogEvent>,
  agentsById: ReadonlyMap<string, RegisteredAgent>,
): RunLogEvent {
  const agent = raw.agent ? agentsById.get(raw.agent) : undefined;

  return {
    time: raw.time ?? new Date(0).toISOString(),
    event: raw.event ?? "register",
    task: raw.task,
    agent: raw.agent ?? "",
    developer: raw.developer ?? agent?.developer ?? "unknown",
    platform: raw.platform ?? agent?.platform ?? "",
    model: raw.model ?? agent?.model ?? "",
    state: raw.state,
    durationSec: raw.durationSec,
    outcome: raw.outcome ?? "ok",
    reason: raw.reason,
  };
}

function agentPath(rootDirectory: string, id: string): string {
  return join(rootDirectory, AGENTS_DIRECTORY, `${id}.json`);
}

function runShardPath(rootDirectory: string, event: RunLogEvent): string {
  const date = event.time.slice(0, 10);
  return join(rootDirectory, RUNS_DIRECTORY, `${date}_${event.developer}_${event.agent}.jsonl`);
}

function stableAgentJson(agent: RegisteredAgent): string {
  return `${JSON.stringify(agent, null, 2)}\n`;
}

function stableEventJson(event: RunLogEvent): string {
  return JSON.stringify(event);
}

async function readShardedAgents(rootDirectory: string): Promise<RegisteredAgent[]> {
  const directory = join(rootDirectory, AGENTS_DIRECTORY);
  const files = await readDirectoryFiles(directory, ".json");
  const agents: RegisteredAgent[] = [];

  for (const file of files) {
    agents.push(canonicalAgent(JSON.parse(await readFile(join(directory, file), "utf8")) as Partial<RegisteredAgent>));
  }

  return agents;
}

async function readLegacyAgents(rootDirectory: string): Promise<RegisteredAgent[]> {
  return (await readJsonlFile<Partial<RegisteredAgent>>(join(rootDirectory, AGENTS_PATH)))
    .map((agent) => canonicalAgent(agent));
}

async function writeAgentShard(
  rootDirectory: string,
  agent: RegisteredAgent,
  allowIdenticalExisting: boolean,
): Promise<"written" | "skipped"> {
  const path = agentPath(rootDirectory, agent.id);
  const content = stableAgentJson(agent);

  await mkdir(dirname(path), { recursive: true });

  try {
    await writeFile(path, content, {
      encoding: "utf8",
      flag: "wx",
    });
    return "written";
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "EEXIST" &&
      allowIdenticalExisting
    ) {
      const existing = canonicalAgent(JSON.parse(await readFile(path, "utf8")) as Partial<RegisteredAgent>);
      if (stableAgentJson(existing) === content) {
        return "skipped";
      }

      throw new Error(`Agent shard conflict: ${agent.id}`);
    }

    throw error;
  }
}

export async function listAgents(rootDirectory: string): Promise<RegisteredAgent[]> {
  const sharded = await readShardedAgents(rootDirectory);
  const shardedIds = new Set(sharded.map((agent) => agent.id));
  const legacy = (await readLegacyAgents(rootDirectory))
    .filter((agent) => !shardedIds.has(agent.id));

  return [...sharded, ...legacy].sort((left, right) => left.id.localeCompare(right.id));
}

export async function findAgent(
  rootDirectory: string,
  id: string,
): Promise<RegisteredAgent | undefined> {
  return (await listAgents(rootDirectory)).find((agent) => agent.id === id);
}

export async function requireAgent(
  rootDirectory: string,
  id: string,
): Promise<RegisteredAgent> {
  const agent = await findAgent(rootDirectory, id);

  if (!agent) {
    throw new Error(`Agent is not registered: ${id}. Run apk agent register --id ${id} --platform <platform> --model <model>.`);
  }

  return agent;
}

export async function registerAgent(
  rootDirectory: string,
  input: RegisterAgentInput,
): Promise<RegisteredAgent> {
  validateCompactValue("Agent id", input.id);
  validateCompactValue("Platform", input.platform);

  if (input.model.trim().length === 0) {
    throw new Error("Model must not be empty.");
  }

  const existing = await findAgent(rootDirectory, input.id);
  if (existing) {
    throw new Error(`Agent already registered: ${input.id}`);
  }

  const agent: RegisteredAgent = {
    id: input.id,
    developer: await detectDeveloperId(rootDirectory, input.developer),
    platform: input.platform,
    model: input.model.trim(),
    label: input.label?.trim() || input.id,
    created: input.created ?? new Date().toISOString(),
  };

  await writeAgentShard(rootDirectory, agent, false);
  await appendRunLog(rootDirectory, {
    event: "register",
    agent,
    outcome: "ok",
  });

  return agent;
}

async function readShardedRunLog(
  rootDirectory: string,
  agentsById: ReadonlyMap<string, RegisteredAgent>,
): Promise<RunLogEvent[]> {
  const directory = join(rootDirectory, RUNS_DIRECTORY);
  const files = await readDirectoryFiles(directory, ".jsonl");
  const events: RunLogEvent[] = [];

  for (const file of files) {
    events.push(
      ...(await readJsonlFile<Partial<RunLogEvent>>(join(directory, file)))
        .map((event) => canonicalRunEvent(event, agentsById)),
    );
  }

  return events;
}

async function readLegacyRunLog(
  rootDirectory: string,
  agentsById: ReadonlyMap<string, RegisteredAgent>,
): Promise<RunLogEvent[]> {
  return (await readJsonlFile<Partial<RunLogEvent>>(join(rootDirectory, RUNS_PATH)))
    .map((event) => canonicalRunEvent(event, agentsById));
}

export async function readRunLog(rootDirectory: string): Promise<RunLogEvent[]> {
  const agents = await listAgents(rootDirectory);
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  const events = [
    ...(await readShardedRunLog(rootDirectory, agentsById)),
    ...(await readLegacyRunLog(rootDirectory, agentsById)),
  ];

  return events.sort((left, right) => left.time.localeCompare(right.time));
}

async function writeRunEvent(
  rootDirectory: string,
  event: RunLogEvent,
  dedupe: boolean,
): Promise<"written" | "skipped"> {
  const path = runShardPath(rootDirectory, event);
  const line = stableEventJson(event);

  await mkdir(dirname(path), { recursive: true });

  if (dedupe) {
    const existing = new Set(
      (await readJsonlFile<RunLogEvent>(path)).map((entry) => stableEventJson(entry)),
    );
    if (existing.has(line)) {
      return "skipped";
    }
  }

  await writeFile(path, `${line}\n`, {
    encoding: "utf8",
    flag: "a",
  });
  return "written";
}

export async function appendRunLog(
  rootDirectory: string,
  input: {
    event: RunEventType;
    agent: RegisteredAgent;
    task?: string;
    state?: TaskState;
    outcome: "ok" | "error";
    reason?: string;
    time?: string;
    durationSec?: number;
  },
): Promise<RunLogEvent> {
  const event: RunLogEvent = {
    time: input.time ?? new Date().toISOString(),
    event: input.event,
    task: input.task,
    agent: input.agent.id,
    developer: input.agent.developer,
    platform: input.agent.platform,
    model: input.agent.model,
    state: input.state,
    durationSec: input.durationSec,
    outcome: input.outcome,
    reason: truncateReason(input.reason),
  };

  await writeRunEvent(rootDirectory, event, false);
  return event;
}

export async function durationSinceLastClaim(
  rootDirectory: string,
  taskId: string,
  agentId: string,
  now = new Date(),
): Promise<number | undefined> {
  const events = await readRunLog(rootDirectory);
  const claim = [...events]
    .reverse()
    .find((event) => (
      event.event === "claim" &&
      event.task === taskId &&
      event.agent === agentId &&
      event.outcome === "ok"
    ));

  if (!claim) {
    return undefined;
  }

  const claimTime = Date.parse(claim.time);
  if (Number.isNaN(claimTime)) {
    return undefined;
  }

  return Math.max(0, Math.round((now.getTime() - claimTime) / 1000));
}

export async function migrateAgentLogs(
  rootDirectory: string,
  options: { removeLegacy?: boolean } = {},
): Promise<MigrateLogsResult> {
  const legacyAgents = await readLegacyAgents(rootDirectory);
  const agentsById = new Map(legacyAgents.map((agent) => [agent.id, agent]));
  const legacyEvents = await readLegacyRunLog(rootDirectory, agentsById);
  const agentsWritten: string[] = [];
  const agentsSkipped: string[] = [];
  let runEventsWritten = 0;
  let runEventsSkipped = 0;

  for (const agent of legacyAgents) {
    const result = await writeAgentShard(rootDirectory, agent, true);
    if (result === "written") {
      agentsWritten.push(agent.id);
    } else {
      agentsSkipped.push(agent.id);
    }
  }

  for (const event of legacyEvents) {
    const result = await writeRunEvent(rootDirectory, event, true);
    if (result === "written") {
      runEventsWritten += 1;
    } else {
      runEventsSkipped += 1;
    }
  }

  if (options.removeLegacy) {
    await rm(join(rootDirectory, AGENTS_PATH), { force: true });
    await rm(join(rootDirectory, RUNS_PATH), { force: true });
  }

  return {
    agentsWritten,
    agentsSkipped,
    runEventsWritten,
    runEventsSkipped,
    removedLegacy: options.removeLegacy ?? false,
  };
}

export function renderAgentsTable(agents: readonly RegisteredAgent[]): string {
  const rows = [
    "id        developer       platform   model       label",
    ...agents.map((agent) => [
      agent.id.padEnd(9),
      agent.developer.padEnd(15),
      agent.platform.padEnd(10),
      agent.model.padEnd(11),
      agent.label,
    ].join(" ")),
  ];

  return `${rows.join("\n")}\n`;
}

export function renderMigrationSummary(result: MigrateLogsResult): string {
  return [
    `Agents written: ${result.agentsWritten.length}`,
    `Agents skipped: ${result.agentsSkipped.length}`,
    `Run events written: ${result.runEventsWritten}`,
    `Run events skipped: ${result.runEventsSkipped}`,
    `Removed legacy: ${result.removedLegacy ? "yes" : "no"}`,
    "",
  ].join("\n");
}

export const VALID_PROMPT_AGENTS = [
  "agents",
  "claude",
  "codex",
  "gemini",
  "opencode",
  "cursor",
] as const;

export type ValidPromptAgent = (typeof VALID_PROMPT_AGENTS)[number];

export function renderAgentSetupPrompt(platform: string): string {
  validateCompactValue("Platform", platform);

  if (!(VALID_PROMPT_AGENTS as readonly string[]).includes(platform)) {
    throw new Error(`Unsupported platform: ${platform}. Supported platforms: ${VALID_PROMPT_AGENTS.join(", ")}.`);
  }

  return [
    "Register before task work:",
    `apk agent register --id ${platform}-a --platform ${platform} --model <model>`,
    "",
    "Then:",
    "apk claim <task-id> --owner <agent-id>",
    "apk context <task-id> --level 2",
    "apk prompt <platform> --task <task-id> --level 2",
    "run verification",
    "apk review <task-id> --owner <agent-id>",
    "apk done <task-id> --owner <agent-id>",
    "",
  ].join("\n");
}
