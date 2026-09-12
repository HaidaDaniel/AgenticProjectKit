import { relative, resolve } from "node:path";
import { readAgenticConfigFile } from "../../core/config/index.js";
import { ACTIVE_TASK_STATES, listArchivedTaskFiles, listTaskFiles, renderTasksTable, TASK_STATES, } from "../../core/tasks/index.js";
const TASKS_HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    "  apk tasks [--all] [--state <state>] [--owner <agent-id>]",
    "",
    "By default only active tasks (todo, doing, review, blocked) are shown.",
    "Use --all to include done, canceled, and archived tasks.",
].join("\n");
function hasHelpFlag(argv) {
    return argv.includes("--help") || argv.includes("-h");
}
function hasAllFlag(argv) {
    return argv.includes("--all");
}
function readFlagValue(argv, flag) {
    const index = argv.indexOf(flag);
    if (index === -1) {
        return undefined;
    }
    if (index === argv.length - 1 || argv[index + 1].startsWith("-")) {
        throw new Error(`${flag} requires a value.`);
    }
    return argv[index + 1];
}
function parseState(value) {
    if (value === undefined) {
        return undefined;
    }
    if (TASK_STATES.includes(value)) {
        return value;
    }
    throw new Error(`State must be one of: ${TASK_STATES.join(", ")}.`);
}
function rejectUnknownOptions(argv) {
    for (const arg of argv) {
        if (arg.startsWith("-") && arg !== "--state" && arg !== "--owner" && arg !== "--all" && arg !== "--help" && arg !== "-h") {
            throw new Error(`Unknown option: ${arg}`);
        }
    }
}
function withRelativePaths(rootDirectory, files) {
    return files.map((file) => ({
        ...file,
        path: relative(rootDirectory, file.path).replace(/\\/g, "/"),
    }));
}
export async function runTasksCommand(argv) {
    if (hasHelpFlag(argv)) {
        console.log(TASKS_HELP_TEXT);
        return 0;
    }
    try {
        rejectUnknownOptions(argv);
        const showAll = hasAllFlag(argv);
        const state = parseState(readFlagValue(argv, "--state"));
        const owner = readFlagValue(argv, "--owner");
        const rootDirectory = resolve(process.cwd());
        const config = await readAgenticConfigFile(rootDirectory);
        let files;
        if (showAll) {
            const [active, archived] = await Promise.all([
                listTaskFiles(rootDirectory, config.taskDirectory),
                listArchivedTaskFiles(rootDirectory, config.taskDirectory),
            ]);
            files = withRelativePaths(rootDirectory, [...active, ...archived]);
        }
        else {
            files = withRelativePaths(rootDirectory, await listTaskFiles(rootDirectory, config.taskDirectory));
        }
        const filtered = files.filter((file) => {
            if (state !== undefined) {
                return file.task.state === state && (owner === undefined || file.task.owner === owner);
            }
            if (showAll) {
                return owner === undefined || file.task.owner === owner;
            }
            return (ACTIVE_TASK_STATES.includes(file.task.state) &&
                (owner === undefined || file.task.owner === owner));
        });
        console.log(renderTasksTable(filtered));
        return 0;
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 1;
    }
}
