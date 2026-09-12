import { resolve } from "node:path";
import { readAgenticConfigFile } from "../../core/config/index.js";
import { blockTask, cancelTask, claimTask, doneTask, releaseTask, reviewTask, } from "../../core/tasks/workflow.js";
import { TASK_REVIEW_OUTCOMES, prepareTaskReview, recordTaskReview, renderTaskReviewResult, } from "../../core/tasks/index.js";
function hasHelpFlag(argv) {
    return argv.includes("--help") || argv.includes("-h");
}
function readFlagValue(argv, flag) {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
}
function readFlagValues(argv, flag) {
    const values = [];
    for (let index = 0; index < argv.length; index += 1) {
        if (argv[index] === flag && argv[index + 1] !== undefined) {
            values.push(argv[index + 1]);
            index += 1;
        }
    }
    return values;
}
function readTaskId(argv, valueFlags = ["--owner", "--reason"]) {
    const positional = [];
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (valueFlags.includes(arg)) {
            index += 1;
            continue;
        }
        if (!arg.startsWith("-")) {
            positional.push(arg);
        }
    }
    return positional.length === 1 ? positional[0] : undefined;
}
function rejectUnknownOptions(argv, allowedFlags = []) {
    const allowed = new Set(["--owner", "--reason", ...allowedFlags]);
    for (const arg of argv) {
        if (arg.startsWith("-") && !allowed.has(arg)) {
            throw new Error(`Unknown option: ${arg}`);
        }
    }
}
function helpText(command) {
    const reason = command === "block" || command === "cancel" ? " [--reason <text>]" : "";
    if (command === "review") {
        return [
            "Usage: apk review <task-id> --owner <agent-id>",
            "Usage: apk review <task-id> --reviewer <reviewer-id> --prompt",
            "Usage: apk review <task-id> --reviewer <reviewer-id> --review-run <review-run-id> --result <pass|changes_requested|fail> [--finding <text>] [--implementation-run <run-id>]",
        ].join("\n");
    }
    return `Usage: apk ${command} <task-id> --owner <agent-id>${reason}`;
}
function renderTransition(task) {
    return [
        `Task: ${task.id}`,
        `State: ${task.state}`,
        `Owner: ${task.owner}`,
    ].join("\n");
}
export async function runTaskStateCommand(command, argv) {
    if (hasHelpFlag(argv)) {
        console.log(helpText(command));
        return 0;
    }
    try {
        if (command === "review" && (argv.includes("--reviewer") ||
            argv.includes("--result") ||
            argv.includes("--prompt"))) {
            const allowedReviewFlags = ["--reviewer", "--result", "--review-run", "--finding", "--implementation-run", "--prompt"];
            rejectUnknownOptions(argv, allowedReviewFlags);
            const taskId = readTaskId(argv, ["--reviewer", "--result", "--review-run", "--finding", "--implementation-run"]);
            const reviewer = readFlagValue(argv, "--reviewer");
            if (!taskId || !reviewer) {
                throw new Error(helpText(command));
            }
            const rootDirectory = resolve(process.cwd());
            const config = await readAgenticConfigFile(rootDirectory);
            if (hasHelpFlag(argv)) {
                console.log(helpText(command));
                return 0;
            }
            if (argv.includes("--prompt")) {
                if (readFlagValue(argv, "--result") !== undefined || readFlagValues(argv, "--finding").length > 0) {
                    throw new Error("--prompt cannot be combined with --result or --finding.");
                }
                const prepared = await prepareTaskReview({
                    rootDirectory,
                    taskDirectory: config.taskDirectory,
                    taskId,
                    reviewer,
                });
                console.log(prepared.prompt);
                return 0;
            }
            const outcome = readFlagValue(argv, "--result");
            const reviewRunId = readFlagValue(argv, "--review-run");
            if (!reviewRunId) {
                throw new Error("--review-run is required when recording a review result; run --prompt first.");
            }
            if (!outcome || !TASK_REVIEW_OUTCOMES.includes(outcome)) {
                throw new Error(`--result must be one of: ${TASK_REVIEW_OUTCOMES.join(", ")}.`);
            }
            if (argv.includes("--prompt")) {
                throw new Error("--prompt cannot be combined with a review result.");
            }
            const result = await recordTaskReview({
                rootDirectory,
                taskDirectory: config.taskDirectory,
                taskId,
                reviewer,
                reviewRunId,
                outcome: outcome,
                findings: readFlagValues(argv, "--finding"),
                implementationRunId: readFlagValue(argv, "--implementation-run"),
            });
            console.log(renderTaskReviewResult(result));
            return result.outcome === "pass" ? 0 : 1;
        }
        rejectUnknownOptions(argv);
        const taskId = readTaskId(argv);
        const owner = readFlagValue(argv, "--owner");
        if (!taskId || !owner) {
            throw new Error(helpText(command));
        }
        const rootDirectory = resolve(process.cwd());
        const config = await readAgenticConfigFile(rootDirectory);
        const options = {
            rootDirectory,
            taskDirectory: config.taskDirectory,
            taskId,
            owner,
            reason: readFlagValue(argv, "--reason"),
        };
        const task = command === "claim"
            ? await claimTask(options)
            : command === "release"
                ? await releaseTask(options)
                : command === "block"
                    ? await blockTask(options)
                    : command === "review"
                        ? await reviewTask(options)
                        : command === "done"
                            ? await doneTask(options)
                            : await cancelTask(options);
        console.log(renderTransition(task));
        return 0;
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 1;
    }
}
