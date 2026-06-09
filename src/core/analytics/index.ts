import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { readRunLog, type RunLogEvent } from "../agents/index.js";
import {
  allTaskFiles,
  type ProjectTask,
} from "../tasks/index.js";

export interface AnalyticsSummaryOptions {
  month?: string;
  taskDirectory?: string;
  docsDirectory?: string;
}

export interface AnalyticsGroup {
  developer: string;
  agent: string;
  platform: string;
  model: string;
  transitions: number;
  tasksDone: number;
  avgDoneSec: number;
  blockCancel: number;
  errors: number;
  risks: Record<string, number>;
  modes: Record<string, number>;
  lanes: Record<string, number>;
}

export interface AnalyticsSummary {
  month: string;
  groups: AnalyticsGroup[];
  outputPath: string;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function validateMonth(month: string): void {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Month must use YYYY-MM format.");
  }
}

async function taskMap(rootDirectory: string, taskDirectory: string): Promise<Map<string, ProjectTask>> {
  try {
    return new Map(
      (await allTaskFiles(rootDirectory, taskDirectory))
        .map(({ task }) => [task.id, task]),
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return new Map();
    }

    throw error;
  }
}

function increment(counts: Record<string, number>, key: string | undefined): void {
  if (!key) {
    return;
  }

  counts[key] = (counts[key] ?? 0) + 1;
}

function renderCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).sort(([left], [right]) => left.localeCompare(right));
  return entries.length === 0
    ? "none"
    : entries.map(([key, value]) => `${key}:${value}`).join(",");
}

function groupKey(event: RunLogEvent): string {
  return [
    event.developer,
    event.agent,
    event.platform,
    event.model,
  ].join("|");
}

export async function summarizeAnalytics(
  rootDirectory: string,
  options: AnalyticsSummaryOptions = {},
): Promise<AnalyticsSummary> {
  const month = options.month ?? currentMonth();
  validateMonth(month);

  const events = (await readRunLog(rootDirectory))
    .filter((event) => event.time.startsWith(month));
  const tasks = await taskMap(rootDirectory, options.taskDirectory ?? ".tasks");
  const groups = new Map<string, AnalyticsGroup & {
    doneDurationTotal: number;
    doneDurationCount: number;
    taskIds: Set<string>;
  }>();

  for (const event of events) {
    const key = groupKey(event);
    const group = groups.get(key) ?? {
      developer: event.developer,
      agent: event.agent,
      platform: event.platform,
      model: event.model,
      transitions: 0,
      tasksDone: 0,
      avgDoneSec: 0,
      blockCancel: 0,
      errors: 0,
      risks: {},
      modes: {},
      lanes: {},
      doneDurationTotal: 0,
      doneDurationCount: 0,
      taskIds: new Set<string>(),
    };

    group.transitions += 1;
    if (event.event === "done") {
      group.tasksDone += 1;
      if (event.durationSec !== undefined) {
        group.doneDurationTotal += event.durationSec;
        group.doneDurationCount += 1;
      }
    }
    if (event.event === "block" || event.event === "cancel") {
      group.blockCancel += 1;
    }
    if (event.outcome === "error") {
      group.errors += 1;
    }
    if (event.task) {
      group.taskIds.add(event.task);
    }

    groups.set(key, group);
  }

  const outputGroups = [...groups.values()]
    .map((group) => {
      for (const taskId of group.taskIds) {
        const task = tasks.get(taskId);
        increment(group.risks, task?.risk);
        increment(group.modes, task?.mode);
        increment(group.lanes, task?.lane);
      }

      return {
        developer: group.developer,
        agent: group.agent,
        platform: group.platform,
        model: group.model,
        transitions: group.transitions,
        tasksDone: group.tasksDone,
        avgDoneSec: group.doneDurationCount === 0
          ? 0
          : Math.round(group.doneDurationTotal / group.doneDurationCount),
        blockCancel: group.blockCancel,
        errors: group.errors,
        risks: group.risks,
        modes: group.modes,
        lanes: group.lanes,
      };
    })
    .sort((left, right) => (
      left.developer.localeCompare(right.developer) ||
      left.agent.localeCompare(right.agent) ||
      left.model.localeCompare(right.model)
    ));

  return {
    month,
    groups: outputGroups,
    outputPath: `${options.docsDirectory ?? "docs"}/analytics/agent-summary-${month}.md`,
  };
}

export function renderAnalyticsSummary(summary: AnalyticsSummary): string {
  return [
    `# Agent Analytics Summary ${summary.month}`,
    "",
    "| developer | agent | platform | model | transitions | done | avgDoneSec | blockCancel | errors | risks | modes | lanes |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |",
    ...(summary.groups.length === 0
      ? ["| none | none | none | none | 0 | 0 | 0 | 0 | 0 | none | none | none |"]
      : summary.groups.map((group) => [
          group.developer,
          group.agent,
          group.platform,
          group.model,
          String(group.transitions),
          String(group.tasksDone),
          String(group.avgDoneSec),
          String(group.blockCancel),
          String(group.errors),
          renderCounts(group.risks),
          renderCounts(group.modes),
          renderCounts(group.lanes),
        ].join(" | ")).map((row) => `| ${row} |`)),
    "",
  ].join("\n");
}

export async function writeAnalyticsSummary(
  rootDirectory: string,
  summary: AnalyticsSummary,
): Promise<string> {
  const path = join(rootDirectory, summary.outputPath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, renderAnalyticsSummary(summary), "utf8");
  return summary.outputPath;
}
