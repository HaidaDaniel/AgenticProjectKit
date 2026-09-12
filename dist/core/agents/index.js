import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
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
    "verify",
    "work",
];
const COMPACT_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
function isMissingFileError(error) {
    return (error !== null &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT");
}
async function readJsonlFile(path) {
    try {
        const text = await readFile(path, "utf8");
        return text
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .map((line) => JSON.parse(line));
    }
    catch (error) {
        if (isMissingFileError(error)) {
            return [];
        }
        throw error;
    }
}
async function readDirectoryFiles(directory, suffix) {
    try {
        return (await readdir(directory))
            .filter((entry) => entry.endsWith(suffix))
            .sort();
    }
    catch (error) {
        if (isMissingFileError(error)) {
            return [];
        }
        throw error;
    }
}
function validateCompactValue(label, value) {
    if (!COMPACT_ID_PATTERN.test(value)) {
        throw new Error(`${label} must be a compact id using lowercase letters, numbers, and dashes.`);
    }
}
export function normalizeDeveloperId(value) {
    const normalized = (value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    return normalized.length > 0 ? normalized : "unknown";
}
async function readGitConfig(rootDirectory, key) {
    try {
        const result = await execFileAsync("git", ["config", "--get", key], {
            cwd: rootDirectory,
        });
        const value = result.stdout.trim();
        return value.length > 0 ? value : undefined;
    }
    catch {
        return undefined;
    }
}
async function detectDeveloperId(rootDirectory, override) {
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
function truncateReason(reason) {
    if (!reason) {
        return undefined;
    }
    return reason.replace(/\s+/g, " ").trim().slice(0, 160);
}
function canonicalAgent(raw) {
    return {
        id: raw.id ?? "",
        developer: raw.developer ?? "unknown",
        platform: raw.platform ?? "",
        model: raw.model ?? "",
        label: raw.label ?? raw.id ?? "",
        created: raw.created ?? "",
    };
}
function canonicalRunEvent(raw, agentsById) {
    const agent = raw.agent ? agentsById.get(raw.agent) : undefined;
    return {
        time: raw.time ?? new Date(0).toISOString(),
        event: raw.event ?? "register",
        task: raw.task,
        runId: raw.runId,
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
function agentPath(rootDirectory, id) {
    return join(rootDirectory, AGENTS_DIRECTORY, `${id}.json`);
}
function runShardPath(rootDirectory, event) {
    const date = event.time.slice(0, 10);
    return join(rootDirectory, RUNS_DIRECTORY, `${date}_${event.developer}_${event.agent}.jsonl`);
}
function stableAgentJson(agent) {
    return `${JSON.stringify(agent, null, 2)}\n`;
}
function stableEventJson(event) {
    return JSON.stringify(event);
}
async function readShardedAgents(rootDirectory) {
    const directory = join(rootDirectory, AGENTS_DIRECTORY);
    const files = await readDirectoryFiles(directory, ".json");
    const agents = [];
    for (const file of files) {
        agents.push(canonicalAgent(JSON.parse(await readFile(join(directory, file), "utf8"))));
    }
    return agents;
}
async function readLegacyAgents(rootDirectory) {
    return (await readJsonlFile(join(rootDirectory, AGENTS_PATH)))
        .map((agent) => canonicalAgent(agent));
}
async function writeAgentShard(rootDirectory, agent, allowIdenticalExisting) {
    const path = agentPath(rootDirectory, agent.id);
    const content = stableAgentJson(agent);
    await mkdir(dirname(path), { recursive: true });
    try {
        await writeFile(path, content, {
            encoding: "utf8",
            flag: "wx",
        });
        return "written";
    }
    catch (error) {
        if (error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "EEXIST" &&
            allowIdenticalExisting) {
            const existing = canonicalAgent(JSON.parse(await readFile(path, "utf8")));
            if (stableAgentJson(existing) === content) {
                return "skipped";
            }
            throw new Error(`Agent shard conflict: ${agent.id}`);
        }
        throw error;
    }
}
export async function listAgents(rootDirectory) {
    const sharded = await readShardedAgents(rootDirectory);
    const shardedIds = new Set(sharded.map((agent) => agent.id));
    const legacy = (await readLegacyAgents(rootDirectory))
        .filter((agent) => !shardedIds.has(agent.id));
    return [...sharded, ...legacy].sort((left, right) => left.id.localeCompare(right.id));
}
export async function findAgent(rootDirectory, id) {
    return (await listAgents(rootDirectory)).find((agent) => agent.id === id);
}
export async function requireAgent(rootDirectory, id) {
    const agent = await findAgent(rootDirectory, id);
    if (!agent) {
        throw new Error(`Agent is not registered: ${id}. Run pnpm exec apk agent register --id ${id} --platform <platform> --model <model>.`);
    }
    return agent;
}
export async function registerAgent(rootDirectory, input) {
    validateCompactValue("Agent id", input.id);
    validateCompactValue("Platform", input.platform);
    if (input.model.trim().length === 0) {
        throw new Error("Model must not be empty.");
    }
    const existing = await findAgent(rootDirectory, input.id);
    if (existing) {
        throw new Error(`Agent already registered: ${input.id}`);
    }
    const agent = {
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
async function readShardedRunLog(rootDirectory, agentsById) {
    const directory = join(rootDirectory, RUNS_DIRECTORY);
    const files = await readDirectoryFiles(directory, ".jsonl");
    const events = [];
    for (const file of files) {
        events.push(...(await readJsonlFile(join(directory, file)))
            .map((event) => canonicalRunEvent(event, agentsById)));
    }
    return events;
}
async function readLegacyRunLog(rootDirectory, agentsById) {
    return (await readJsonlFile(join(rootDirectory, RUNS_PATH)))
        .map((event) => canonicalRunEvent(event, agentsById));
}
export async function readRunLog(rootDirectory) {
    const agents = await listAgents(rootDirectory);
    const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
    const events = [
        ...(await readShardedRunLog(rootDirectory, agentsById)),
        ...(await readLegacyRunLog(rootDirectory, agentsById)),
    ];
    return events.sort((left, right) => left.time.localeCompare(right.time));
}
async function writeRunEvent(rootDirectory, event, dedupe) {
    const path = runShardPath(rootDirectory, event);
    const line = stableEventJson(event);
    await mkdir(dirname(path), { recursive: true });
    if (dedupe) {
        const existing = new Set((await readJsonlFile(path)).map((entry) => stableEventJson(entry)));
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
export async function appendRunLog(rootDirectory, input) {
    const event = {
        time: input.time ?? new Date().toISOString(),
        event: input.event,
        task: input.task,
        runId: input.runId,
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
export async function durationSinceLastClaim(rootDirectory, taskId, agentId, now = new Date()) {
    const events = await readRunLog(rootDirectory);
    const claim = [...events]
        .reverse()
        .find((event) => (event.event === "claim" &&
        event.task === taskId &&
        event.agent === agentId &&
        event.outcome === "ok"));
    if (!claim) {
        return undefined;
    }
    const claimTime = Date.parse(claim.time);
    if (Number.isNaN(claimTime)) {
        return undefined;
    }
    return Math.max(0, Math.round((now.getTime() - claimTime) / 1000));
}
export async function migrateAgentLogs(rootDirectory, options = {}) {
    const legacyAgents = await readLegacyAgents(rootDirectory);
    const agentsById = new Map(legacyAgents.map((agent) => [agent.id, agent]));
    const legacyEvents = await readLegacyRunLog(rootDirectory, agentsById);
    const agentsWritten = [];
    const agentsSkipped = [];
    let runEventsWritten = 0;
    let runEventsSkipped = 0;
    for (const agent of legacyAgents) {
        const result = await writeAgentShard(rootDirectory, agent, true);
        if (result === "written") {
            agentsWritten.push(agent.id);
        }
        else {
            agentsSkipped.push(agent.id);
        }
    }
    for (const event of legacyEvents) {
        const result = await writeRunEvent(rootDirectory, event, true);
        if (result === "written") {
            runEventsWritten += 1;
        }
        else {
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
export function renderAgentsTable(agents) {
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
export function renderMigrationSummary(result) {
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
];
export function renderAgentSetupPrompt(platform) {
    validateCompactValue("Platform", platform);
    if (!VALID_PROMPT_AGENTS.includes(platform)) {
        throw new Error(`Unsupported platform: ${platform}. Supported platforms: ${VALID_PROMPT_AGENTS.join(", ")}.`);
    }
    return [
        "Register before task work:",
        `pnpm exec apk agent register --id ${platform}-a --platform ${platform} --model <model>`,
        "",
        "Then:",
        "pnpm exec apk claim <task-id> --owner <agent-id>",
        "pnpm exec apk context <task-id> --level 2",
        `pnpm exec apk prompt ${platform} --task <task-id> --level 2`,
        "run verification",
        "pnpm exec apk review <task-id> --owner <agent-id>",
        "pnpm exec apk done <task-id> --owner <agent-id>",
        "",
    ].join("\n");
}
