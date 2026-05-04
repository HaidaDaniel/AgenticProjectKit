import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { TaskState } from "../tasks/index.js";

export const AGENTS_PATH = ".agentic/agents.jsonl";
export const RUNS_PATH = ".agentic/runs.jsonl";

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
  platform: string;
  model: string;
  label: string;
  created: string;
}

export interface RegisterAgentInput {
  id: string;
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
  platform: string;
  model: string;
  state?: TaskState;
  durationSec?: number;
  outcome: "ok" | "error";
  reason?: string;
}

const COMPACT_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

async function readJsonlFile<T>(path: string): Promise<T[]> {
  try {
    const text = await readFile(path, "utf8");
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as T);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
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

function truncateReason(reason: string | undefined): string | undefined {
  if (!reason) {
    return undefined;
  }

  return reason.replace(/\s+/g, " ").trim().slice(0, 160);
}

export async function listAgents(rootDirectory: string): Promise<RegisteredAgent[]> {
  return readJsonlFile<RegisteredAgent>(join(rootDirectory, AGENTS_PATH));
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
    platform: input.platform,
    model: input.model.trim(),
    label: input.label?.trim() || input.id,
    created: input.created ?? new Date().toISOString(),
  };
  const path = join(rootDirectory, AGENTS_PATH);

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(agent)}\n`, {
    encoding: "utf8",
    flag: "a",
  });
  await appendRunLog(rootDirectory, {
    event: "register",
    agent,
    outcome: "ok",
  });

  return agent;
}

export async function readRunLog(rootDirectory: string): Promise<RunLogEvent[]> {
  return readJsonlFile<RunLogEvent>(join(rootDirectory, RUNS_PATH));
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
    platform: input.agent.platform,
    model: input.agent.model,
    state: input.state,
    durationSec: input.durationSec,
    outcome: input.outcome,
    reason: truncateReason(input.reason),
  };
  const path = join(rootDirectory, RUNS_PATH);

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(event)}\n`, {
    encoding: "utf8",
    flag: "a",
  });

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

export function renderAgentsTable(agents: readonly RegisteredAgent[]): string {
  const rows = [
    "id        platform   model       label",
    ...agents.map((agent) => [
      agent.id.padEnd(9),
      agent.platform.padEnd(10),
      agent.model.padEnd(11),
      agent.label,
    ].join(" ")),
  ];

  return `${rows.join("\n")}\n`;
}

export const VALID_PROMPT_AGENTS = [
  "agents",
  "codex",
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
