import {
  AGENT_EXPORT_TARGETS,
  type AgentExportTarget,
} from "../exporters/index.js";
import type { ProjectTask } from "../tasks/index.js";
import {
  selectTaskContext,
  type ContextLevel,
  type TaskContextOptions,
  type TaskContextSelection,
} from "./context.js";

export const PROMPT_AGENTS = AGENT_EXPORT_TARGETS;
export type PromptAgent = AgentExportTarget;

export interface TaskPromptInput {
  agent: PromptAgent;
  task: ProjectTask;
  context: TaskContextSelection;
}

export class PromptAgentError extends Error {
  constructor(agent: string) {
    super(`Unsupported prompt agent: ${agent}. Expected one of: ${PROMPT_AGENTS.join(", ")}.`);
    this.name = "PromptAgentError";
  }
}

function renderList(items: readonly string[]): string[] {
  return items.map((item) => `- ${item}`);
}

export function parsePromptAgent(agent: string): PromptAgent {
  if ((PROMPT_AGENTS as readonly string[]).includes(agent)) {
    return agent as PromptAgent;
  }

  throw new PromptAgentError(agent);
}

export function buildTaskPromptInput(
  agent: string,
  task: ProjectTask,
  level: ContextLevel,
  options: TaskContextOptions = {},
): TaskPromptInput {
  return {
    agent: parsePromptAgent(agent),
    task,
    context: selectTaskContext(task, level, options),
  };
}

export function renderTaskPrompt(input: TaskPromptInput): string {
  const { agent, task, context } = input;

  return [
    `Agent: ${agent}`,
    `Task: ${task.id} - ${task.title}`,
    `Mode: ${task.mode}`,
    `Risk: ${task.risk}`,
    "",
    "Goal:",
    task.goal,
    "",
    `Context level: ${context.level}`,
    "Context files:",
    ...renderList(context.files),
    "",
    "Allowed files:",
    ...renderList(task.allowedFiles),
    "",
    "Forbidden files:",
    ...renderList(task.forbiddenFiles),
    "",
    "Acceptance criteria:",
    ...renderList(task.acceptanceCriteria),
    "",
    "Verification commands:",
    ...renderList(task.verificationCommands),
    "",
    "Rules:",
    "- Read context files first.",
    "- Work only inside allowed files.",
    "- Do not touch forbidden files.",
    "- Run verification before done.",
    "",
  ].join("\n");
}
