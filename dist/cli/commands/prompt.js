import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { readAgenticConfigFile } from "../../core/config/index.js";
import { buildTaskPromptInputFromRepository, PROMPT_AGENTS, renderTaskPrompt, } from "../../core/docs/prompt.js";
import { findTaskFile, parseTaskMarkdown } from "../../core/tasks/index.js";
const PROMPT_HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    "  apk prompt <agent> --task <task-id> [--level 1|2|3] [--budget <units>]",
    "",
    "Agents:",
    ...PROMPT_AGENTS.map((agent) => `  ${agent}`),
    "",
    "Generates a concise task prompt with exact context files.",
].join("\n");
function hasHelpFlag(argv) {
    return argv.includes("--help") || argv.includes("-h");
}
function readFlagValue(argv, flag) {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
}
function readLevel(argv) {
    const rawLevel = readFlagValue(argv, "--level");
    if (rawLevel === undefined) {
        return 1;
    }
    if (rawLevel === "1" || rawLevel === "2" || rawLevel === "3") {
        return Number(rawLevel);
    }
    throw new Error("Context level must be 1, 2, or 3.");
}
function readBudget(argv) {
    const index = argv.indexOf("--budget");
    if (index === -1)
        return undefined;
    const rawBudget = argv[index + 1];
    if (rawBudget === undefined || !/^\d+$/.test(rawBudget) || Number(rawBudget) <= 0) {
        throw new Error("Context budget must be a positive integer.");
    }
    return Number(rawBudget);
}
function parsePromptArgs(argv) {
    const positional = [];
    let taskId;
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--task") {
            taskId = argv[index + 1];
            index += 1;
            continue;
        }
        if (arg === "--level") {
            index += 1;
            continue;
        }
        if (arg === "--budget") {
            index += 1;
            continue;
        }
        if (arg.startsWith("-")) {
            throw new Error(`Unknown option: ${arg}`);
        }
        positional.push(arg);
    }
    if (positional.length !== 1 || !taskId || taskId.startsWith("-")) {
        throw new Error("Usage: apk prompt <agent> --task <task-id> [--level 1|2|3]");
    }
    const budget = readBudget(argv);
    return {
        agent: positional[0],
        taskId,
        level: readLevel(argv),
        ...(budget === undefined ? {} : { budget }),
    };
}
export async function runPromptCommand(argv) {
    if (hasHelpFlag(argv)) {
        console.log(PROMPT_HELP_TEXT);
        return 0;
    }
    try {
        const args = parsePromptArgs(argv);
        const rootDirectory = resolve(process.cwd());
        const config = await readAgenticConfigFile(rootDirectory);
        const taskFile = await findTaskFile(rootDirectory, args.taskId, config.taskDirectory);
        const task = parseTaskMarkdown(await readFile(taskFile, "utf8"));
        const prompt = await buildTaskPromptInputFromRepository(rootDirectory, args.agent, task, args.level, {
            docsDirectory: config.docsDirectory,
            taskFile: relative(rootDirectory, taskFile),
            taskDirectory: config.taskDirectory,
            ...(args.budget === undefined ? {} : { budget: args.budget }),
        });
        console.log(renderTaskPrompt(prompt));
        return prompt.context.diagnostics && prompt.context.diagnostics.length > 0 ? 1 : 0;
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 1;
    }
}
