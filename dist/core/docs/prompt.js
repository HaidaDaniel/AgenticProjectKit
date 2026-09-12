import { AGENT_EXPORT_TARGETS, } from "../exporters/index.js";
import { buildTaskContextPack, selectTaskContext, } from "./context.js";
import { getTaskVerification } from "../tasks/index.js";
export const PROMPT_AGENTS = AGENT_EXPORT_TARGETS;
export class PromptAgentError extends Error {
    constructor(agent) {
        super(`Unsupported prompt agent: ${agent}. Expected one of: ${PROMPT_AGENTS.join(", ")}.`);
        this.name = "PromptAgentError";
    }
}
function renderList(items) {
    return items.map((item) => `- ${item}`);
}
function renderCorrectnessRequirements(task) {
    const groups = [
        ["Assumptions", task.correctnessAssumptions],
        ["Invariants", task.invariants],
        ["Required evidence", task.requiredEvidence],
        ["Review questions", task.reviewQuestions],
        ["Counterexample searches", task.counterexampleSearches],
    ];
    const populated = groups.filter(([, items]) => items && items.length > 0);
    if (populated.length === 0) {
        return [];
    }
    return [
        "Correctness requirements:",
        ...populated.flatMap(([label, items]) => [
            `${label}:`,
            ...renderList(items),
        ]),
        "",
    ];
}
function renderVerificationRequirement(check) {
    const requirement = check.required ? "required" : "optional";
    const subject = check.type === "automated"
        ? `command=${check.command}`
        : `instruction=${check.instruction}`;
    const extras = [
        check.artifact ? `artifact=${check.artifact}` : undefined,
        check.evidence ? `evidence=${check.evidence}` : undefined,
    ].filter((value) => value !== undefined);
    return `- ${check.id} [${requirement}] type=${check.type}; environment=${check.environment}; profile=${check.profile}; ${subject}${extras.length > 0 ? `; ${extras.join("; ")}` : ""}`;
}
export function parsePromptAgent(agent) {
    if (PROMPT_AGENTS.includes(agent)) {
        return agent;
    }
    throw new PromptAgentError(agent);
}
export function buildTaskPromptInput(agent, task, level, options = {}) {
    return {
        agent: parsePromptAgent(agent),
        task,
        context: selectTaskContext(task, level, {
            ...options,
            includeModeGuidance: true,
        }),
    };
}
export async function buildTaskPromptInputFromRepository(rootDirectory, agent, task, level, options = {}) {
    return {
        agent: parsePromptAgent(agent),
        task,
        context: await buildTaskContextPack(rootDirectory, task, level, {
            ...options,
            includeModeGuidance: true,
        }),
    };
}
export function renderTaskPrompt(input) {
    const { agent, task, context } = input;
    return [
        `Agent: ${agent}`,
        `Task: ${task.id} - ${task.title}`,
        `State: ${task.state}`,
        `Owner: ${task.owner}`,
        `Mode: ${task.mode}`,
        `Lane: ${task.lane}`,
        `Scope: ${task.scope.length > 0 ? task.scope.join(",") : "none"}`,
        `Risk: ${task.risk}`,
        `Parallel: ${task.parallel ? "true" : "false"}`,
        `Tags: ${task.tags.length > 0 ? task.tags.join(",") : "none"}`,
        "",
        "Goal:",
        task.goal,
        "",
        `Context level: ${context.level}`,
        ...(context.budget === undefined ? [] : [
            `Context budget: ${context.budget} units`,
            `Context estimated units: ${context.estimatedUnits ?? 0}`,
        ]),
        "Context files:",
        ...renderList(context.files),
        ...(context.diagnostics && context.diagnostics.length > 0
            ? [
                "",
                "Context diagnostics:",
                ...context.diagnostics.map((diagnostic) => `- ${diagnostic.message}`),
            ]
            : []),
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
        ...renderCorrectnessRequirements(task),
        ...(task.verification !== undefined ? [
            "Verification requirements:",
            ...getTaskVerification(task).map(renderVerificationRequirement),
            "",
        ] : []),
        "Verification commands:",
        ...renderList(task.verificationCommands),
        "",
        "Rules:",
        ...(context.modeGuidance ? renderList(context.modeGuidance) : []),
        "- Read context files first.",
        "- Work only inside allowed files.",
        "- Do not touch forbidden files.",
        "- Run verification before done.",
        "",
    ].join("\n");
}
