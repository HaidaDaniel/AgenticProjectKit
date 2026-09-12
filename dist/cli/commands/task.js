import { join, relative, resolve } from "node:path";
import { readAgenticConfigFile } from "../../core/config/index.js";
import { getTaskTemplate, resolveTaskTemplateType, TASK_TEMPLATE_TYPES, } from "../../core/templates/task-templates.js";
import { archiveAllTasks, archiveTask, buildTaskProvenance, buildTaskDeps, createTask, evaluateTaskCompletionGate, findTaskFile, listArchivedTaskFiles, listTaskFiles, loadTaskFile, readTaskEvidence, renderTaskPolicy, renderTaskDeps, renderTaskEvidence, renderTaskCompletionGate, renderTaskProvenance, renderTaskVerifyResult, renderRecordManualVerificationResult, recordManualVerification, renderDogfoodResult, renderDogfoodSession, recordDogfoodResult, resolveTaskPolicy, startDogfoodSession, TASK_MODES, TASK_RISKS, TASK_VERIFICATION_PROFILES, normalizeVerificationCommands, verifyTask, } from "../../core/tasks/index.js";
import { TASK_EVIDENCE_LOCK_PATH } from "../../core/tasks/evidence.js";
import { inspectLocalMutationLock, recoverLocalLock, renderLocalLockInspection, } from "../../core/tasks/lock.js";
const TASK_HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    "  apk task archive [<task-id>] [--all]",
    "  apk task deps <task-id>",
    "  apk task evidence <task-id>",
    "  apk task lock status [--kind <task|evidence>] [--json]",
    "  apk task lock recover --kind <task|evidence> [--force]",
    "  apk task policy <task-id>",
    "  apk task gate <task-id>",
    "  apk task provenance <task-id> [--json]",
    "  apk task dogfood start <task-id> --owner <agent-id> --tool <tool> --scenario <text>",
    "  apk task dogfood result <task-id> --owner <agent-id> --session <session-id> --outcome <pass|fail>",
    "  apk task verify <task-id> [--check-files-only] [--profile <profile|all>] [--owner <agent-id>]",
    "  apk task verify <task-id> --record --owner <agent-id> --check <check-id> --result <pass|fail> --evidence <reference> [--summary <text>]",
    "  apk task create --title <title> --scope <csv> --allowed <csv> [--type <name>|--template <name>] [--mode <mode>] [--lane <lane>] [--risk <risk>] [--context <csv>] [--verification <csv>] [--verification-json <json>] [--goal <text>]",
    "",
    "Subcommands:",
    "  archive Archive a done task or all done tasks.",
    "  deps    Inspect task prerequisites, dependents, and graph problems.",
    "  evidence List append-only evidence records for a task.",
    "  lock    Inspect or explicitly recover local mutation locks.",
    "  policy  Resolve deterministic risk and tag requirements.",
    "  gate    Preview completion blockers for the current candidate.",
    "  provenance Show bounded task/run/evidence provenance.",
    "  dogfood Start a bounded agent usability session or record its result.",
    "  verify  Check files, resolve profiles, and record per-check evidence.",
    "  create  Generate a new task file with validated metadata.",
].join("\n");
const TASK_LOCK_HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    "  apk task lock status [--kind <task|evidence>] [--json]",
    "  apk task lock recover --kind <task|evidence> [--force]",
    "",
    "Dead local owners recover automatically on the next mutation.",
    "Use --force for malformed or uncertain ownership only after verifying no owner is running.",
    "A live local owner is never recovered, even with --force.",
].join("\n");
const TASK_DEPS_HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    "  apk task deps <task-id>",
    "",
    "Print task prerequisites, dependents, missing deps, and cycle issues.",
].join("\n");
const TASK_EVIDENCE_HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    "  apk task evidence <task-id>",
    "",
    "List append-only task evidence records from .agentic/evidence.jsonl.",
].join("\n");
const TASK_POLICY_HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    "  apk task policy <task-id>",
    "",
    "Resolve deterministic requirements from task risk and tags.",
    "Reports blockers and diagnostics without changing task state.",
].join("\n");
const TASK_GATE_HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    "  apk task gate <task-id>",
    "",
    "Preview verification, scope, dependency, policy, evidence, and review gates.",
    "The command is read-only and reports blockers for the current candidate.",
].join("\n");
const TASK_PROVENANCE_HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    "  apk task provenance <task-id> [--json]",
    "",
    "Show baseline, commits/diff, run identities, evidence freshness, superseded links, and completion evidence.",
    "Output is bounded and excludes raw logs.",
].join("\n");
const TASK_DOGFOOD_HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    "  apk task dogfood start <task-id> --owner <agent-id> --tool <tool> --scenario <text> [--session <id>] [--started-at <ISO timestamp>]",
    "  apk task dogfood result <task-id> --owner <agent-id> --session <session-id> --outcome <pass|fail> [--ended-at <ISO timestamp>] [--failures <csv>] [--retries <n>] [--observations <csv>] [--issues <csv>] [--metrics-json <json>]",
    "",
    "Start writes a reproducible prompt and session metadata without launching a model.",
    "Result writes distinct bounded dogfood evidence; failed sessions remain fail.",
].join("\n");
const TASK_CREATE_HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    "  apk task create --title <title> --scope <csv> --allowed <csv> [--type <name>|--template <name>] [--mode <mode>] [--lane <lane>] [--risk <risk>] [--context <csv>] [--verification <csv>] [--verification-json <json>] [--goal <text>]",
    "",
    "Required flags:",
    "  --title <title>         Task title.",
    "  --scope <csv>           Comma-separated scope areas (e.g. cli,tasks,docs).",
    "  --allowed <csv>         Comma-separated allowed file paths.",
    "",
    "Optional flags:",
    "  --type <name>           Typed contract: feature, bugfix, refactor, migration, async-worker, provider-integration, deployment, benchmark, security, release (or existing docs, audit, test).",
    "  --template <name>       Alias for --type; existing generic templates remain supported.",
    "  --mode <mode>           Task mode: discovery, mvp, product, production, maintenance, audit, adopt.",
    "  --lane <lane>           Work lane (e.g. implementation, planning, adoption).",
    "  --risk <risk>           Risk level: low, medium, high, critical.",
    "  --context <csv>         Comma-separated context file paths.",
    "  --verification <csv>    Comma-separated legacy verification commands; normalized to required local deterministic checks.",
    "  --verification-json <json>  Structured verification check array.",
    "  --goal <text>           Task goal text (default: title).",
    "  --depends <csv>         Comma-separated dependency task ids.",
    "  --tags <csv>            Comma-separated tags.",
    "  --parallel              Mark task as parallel (default: false).",
    "  --forbidden <csv>       Comma-separated forbidden file paths.",
    "  --steps <csv>           Comma-separated numbered steps.",
    "  --acceptance <csv>      Comma-separated acceptance criteria.",
    "  --assumptions <csv>     Correctness assumptions to challenge.",
    "  --invariants <csv>      Invariants that must remain true.",
    "  --required-evidence <csv>  Evidence references required by the task.",
    "  --review-questions <csv>  Questions for an independent reviewer.",
    "  --counterexample-searches <csv>  Counterexamples the reviewer should seek.",
    "  --docs <csv>            Comma-separated documentation updates.",
    "  --notes <csv>           Comma-separated notes.",
    "",
    "Example:",
    '  apk task create --title "Add Feature" --mode mvp --lane implementation --scope api,docs --risk low --context "AGENTS.md,docs/task-system.md" --allowed "src/api/index.ts" --verification "pnpm test"',
].join("\n");
const TASK_VERIFY_HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    "  apk task verify <task-id> [--check-files-only] [--profile <profile|all>] [--owner <agent-id>]",
    "  apk task verify <task-id> --record --owner <agent-id> --check <check-id> --result <pass|fail> --evidence <reference> [--summary <text>]",
    "",
    "Checks changed files against task allowed/forbidden files.",
    "Runs selected eligible automated checks and records per-check evidence.",
    "Manual/live and unselected checks remain visible as unavailable or not-run.",
    "Use --record to store an externally-observed manual/live check result bound to the current candidate.",
].join("\n");
const TASK_ARCHIVE_HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    "  apk task archive [<task-id>] [--all]",
    "  apk task archive <task-id>",
    "  apk task archive --all",
    "",
    "Archive a done task by moving it to .tasks/archive/.",
    "Use --all to archive all done top-level tasks.",
    "",
    "Only tasks in state 'done' can be archived.",
].join("\n");
function hasHelpFlag(argv) {
    return argv.includes("--help") || argv.includes("-h");
}
function rejectUnknownOptions(argv) {
    for (const arg of argv) {
        if (arg.startsWith("-") && arg !== "--help" && arg !== "-h") {
            throw new Error(`Unknown option: ${arg}`);
        }
    }
}
function parseFlag(argv, flag) {
    const index = argv.indexOf(flag);
    if (index === -1) {
        return undefined;
    }
    if (index === argv.length - 1 || argv[index + 1].startsWith("-")) {
        throw new Error(`${flag} requires a value.`);
    }
    return argv[index + 1];
}
function parseCsvFlag(value) {
    if (!value)
        return [];
    return value.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}
function hasFlag(argv, flag) {
    return argv.includes(flag);
}
function parseTemplate(name, flag = "--template") {
    if (name === undefined)
        return undefined;
    try {
        const type = resolveTaskTemplateType(name);
        return { type, defaults: getTaskTemplate(type) };
    }
    catch {
        throw new Error(`${flag} must be one of: ${TASK_TEMPLATE_TYPES.join(", ")}.`);
    }
}
async function runCreateSubcommand(argv) {
    if (hasHelpFlag(argv)) {
        console.log(TASK_CREATE_HELP_TEXT);
        return 0;
    }
    const knownFlags = new Set([
        "--title", "--mode", "--lane", "--scope", "--risk", "--parallel",
        "--goal", "--template", "--type",
        "--depends", "--tags", "--context", "--allowed", "--forbidden",
        "--steps", "--acceptance", "--verification", "--verification-json", "--docs", "--notes",
        "--assumptions", "--invariants", "--required-evidence", "--review-questions", "--counterexample-searches",
        "--help", "-h",
    ]);
    for (const arg of argv) {
        if (arg.startsWith("-") && !knownFlags.has(arg)) {
            throw new Error(`Unknown option: ${arg}`);
        }
    }
    const title = parseFlag(argv, "--title");
    if (!title) {
        throw new Error("--title is required.");
    }
    const templateFlag = parseFlag(argv, "--template");
    const typeFlag = parseFlag(argv, "--type");
    const templateFromFlag = parseTemplate(templateFlag);
    const typeFromFlag = parseTemplate(typeFlag, "--type");
    if (templateFromFlag && typeFromFlag && templateFromFlag.type !== typeFromFlag.type) {
        throw new Error("--type and --template must name the same task template.");
    }
    const template = typeFromFlag ?? templateFromFlag;
    const modeRaw = parseFlag(argv, "--mode");
    const mode = modeRaw ?? template?.defaults.mode;
    if (!mode || !TASK_MODES.includes(mode)) {
        throw new Error(`--mode must be one of: ${TASK_MODES.join(", ")}.`);
    }
    const lane = parseFlag(argv, "--lane") ?? template?.defaults.lane;
    if (!lane) {
        throw new Error("--lane is required.");
    }
    const riskRaw = parseFlag(argv, "--risk");
    const risk = riskRaw ?? template?.defaults.risk;
    if (!risk || !TASK_RISKS.includes(risk)) {
        throw new Error(`--risk must be one of: ${TASK_RISKS.join(", ")}.`);
    }
    const scope = parseCsvFlag(parseFlag(argv, "--scope"));
    const contextFiles = parseCsvFlag(parseFlag(argv, "--context"));
    const allowedFiles = parseCsvFlag(parseFlag(argv, "--allowed"));
    const verificationCommands = parseCsvFlag(parseFlag(argv, "--verification"));
    const correctnessAssumptions = parseCsvFlag(parseFlag(argv, "--assumptions"));
    const invariants = parseCsvFlag(parseFlag(argv, "--invariants"));
    const requiredEvidence = parseCsvFlag(parseFlag(argv, "--required-evidence"));
    const reviewQuestions = parseCsvFlag(parseFlag(argv, "--review-questions"));
    const counterexampleSearches = parseCsvFlag(parseFlag(argv, "--counterexample-searches"));
    const resolvedCorrectnessAssumptions = correctnessAssumptions.length > 0
        ? correctnessAssumptions : template?.defaults.correctnessAssumptions ?? [];
    const resolvedInvariants = invariants.length > 0 ? invariants : template?.defaults.invariants ?? [];
    const resolvedRequiredEvidence = requiredEvidence.length > 0
        ? requiredEvidence : template?.defaults.requiredEvidence ?? [];
    const resolvedReviewQuestions = reviewQuestions.length > 0
        ? reviewQuestions : template?.defaults.reviewQuestions ?? [];
    const resolvedCounterexampleSearches = counterexampleSearches.length > 0
        ? counterexampleSearches : template?.defaults.counterexampleSearches ?? [];
    const resolvedContextFiles = contextFiles.length > 0 ? contextFiles : template?.defaults.contextFiles ?? [];
    const verificationJson = parseFlag(argv, "--verification-json");
    let structuredVerification;
    if (verificationJson !== undefined) {
        let parsed;
        try {
            parsed = JSON.parse(verificationJson);
        }
        catch (error) {
            throw new Error(`--verification-json must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
        if (!Array.isArray(parsed)) {
            throw new Error("--verification-json must contain a JSON array of verification checks.");
        }
        structuredVerification = parsed;
    }
    const resolvedVerification = structuredVerification
        ?? (verificationCommands.length > 0
            ? normalizeVerificationCommands(verificationCommands)
            : template?.defaults.verification ?? []);
    if (resolvedContextFiles.length === 0) {
        throw new Error("--context must include at least one file.");
    }
    if (scope.length === 0) {
        throw new Error("--scope must include at least one scope area.");
    }
    if (allowedFiles.length === 0) {
        throw new Error("--allowed must include at least one file.");
    }
    if (resolvedVerification.length === 0) {
        throw new Error("--verification or --verification-json must include at least one check.");
    }
    const input = {
        title,
        mode: mode,
        lane,
        type: template?.type,
        scope,
        risk: risk,
        parallel: hasFlag(argv, "--parallel"),
        dependsOn: parseCsvFlag(parseFlag(argv, "--depends")),
        tags: parseCsvFlag(parseFlag(argv, "--tags")).length > 0
            ? parseCsvFlag(parseFlag(argv, "--tags"))
            : template?.defaults.tags ?? [],
        goal: parseFlag(argv, "--goal") ?? title,
        contextFiles: resolvedContextFiles,
        allowedFiles,
        forbiddenFiles: parseCsvFlag(parseFlag(argv, "--forbidden")),
        steps: parseCsvFlag(parseFlag(argv, "--steps")).length > 0
            ? parseCsvFlag(parseFlag(argv, "--steps"))
            : template?.defaults.steps ?? [],
        acceptanceCriteria: parseCsvFlag(parseFlag(argv, "--acceptance")).length > 0
            ? parseCsvFlag(parseFlag(argv, "--acceptance"))
            : template?.defaults.acceptanceCriteria ?? [],
        correctnessAssumptions: resolvedCorrectnessAssumptions,
        invariants: resolvedInvariants,
        requiredEvidence: resolvedRequiredEvidence,
        reviewQuestions: resolvedReviewQuestions,
        counterexampleSearches: resolvedCounterexampleSearches,
        verification: resolvedVerification,
        documentationUpdates: parseCsvFlag(parseFlag(argv, "--docs")).length > 0
            ? parseCsvFlag(parseFlag(argv, "--docs"))
            : template?.defaults.documentationUpdates ?? [],
        notes: parseCsvFlag(parseFlag(argv, "--notes")).length > 0
            ? parseCsvFlag(parseFlag(argv, "--notes"))
            : template?.defaults.notes ?? [],
    };
    const rootDirectory = resolve(process.cwd());
    const config = await readAgenticConfigFile(rootDirectory);
    const result = await createTask(rootDirectory, config.taskDirectory, input);
    console.log(`Created: ${result.path}`);
    return 0;
}
async function runDepsSubcommand(argv) {
    if (hasHelpFlag(argv)) {
        console.log(TASK_DEPS_HELP_TEXT);
        return 0;
    }
    rejectUnknownOptions(argv);
    const positional = [];
    for (const arg of argv) {
        if (!arg.startsWith("-")) {
            positional.push(arg);
        }
    }
    if (positional.length !== 1) {
        throw new Error("Usage: apk task deps <task-id>");
    }
    const taskId = positional[0];
    const rootDirectory = resolve(process.cwd());
    const config = await readAgenticConfigFile(rootDirectory);
    const files = await listTaskFiles(rootDirectory, config.taskDirectory);
    const archived = await listArchivedTaskFiles(rootDirectory, config.taskDirectory);
    const taskFile = await findTaskFile(rootDirectory, taskId, config.taskDirectory);
    const relativePath = relative(rootDirectory, taskFile).replace(/\\/g, "/");
    const result = buildTaskDeps(files, taskId, relativePath, archived);
    if (!result) {
        throw new Error(`Task file not found for id: ${taskId}`);
    }
    console.log(renderTaskDeps(result));
    return 0;
}
async function runArchiveSubcommand(argv) {
    if (hasHelpFlag(argv)) {
        console.log(TASK_ARCHIVE_HELP_TEXT);
        return 0;
    }
    const knownArchiveFlags = new Set(["--all", "--help", "-h"]);
    for (const arg of argv) {
        if (arg.startsWith("-") && !knownArchiveFlags.has(arg)) {
            throw new Error(`Unknown option: ${arg}`);
        }
    }
    const positional = [];
    for (const arg of argv) {
        if (!arg.startsWith("-")) {
            positional.push(arg);
        }
    }
    if (hasFlag(argv, "--all")) {
        if (positional.length !== 0) {
            throw new Error("Usage: apk task archive --all (no positional args with --all)");
        }
        const rootDirectory = resolve(process.cwd());
        const config = await readAgenticConfigFile(rootDirectory);
        const result = await archiveAllTasks(rootDirectory, config.taskDirectory);
        if (result.archived.length === 0) {
            console.log("No done tasks to archive.");
            return 0;
        }
        for (const a of result.archived) {
            console.log(`Archived: ${a.taskId} -> ${a.archivePath}`);
        }
        return 0;
    }
    if (positional.length !== 1) {
        throw new Error("Usage: apk task archive <task-id>");
    }
    const rootDirectory = resolve(process.cwd());
    const config = await readAgenticConfigFile(rootDirectory);
    const taskId = positional[0];
    const result = await archiveTask(rootDirectory, config.taskDirectory, taskId);
    console.log(`Archived: ${result.taskId} -> ${result.archivePath}`);
    return 0;
}
async function runEvidenceSubcommand(argv) {
    if (hasHelpFlag(argv)) {
        console.log(TASK_EVIDENCE_HELP_TEXT);
        return 0;
    }
    rejectUnknownOptions(argv);
    if (argv.length !== 1) {
        throw new Error("Usage: apk task evidence <task-id>");
    }
    const rootDirectory = resolve(process.cwd());
    const records = await readTaskEvidence(rootDirectory);
    console.log(renderTaskEvidence(records, argv[0]));
    return 0;
}
function parseLockKind(argv) {
    const value = parseFlag(argv, "--kind");
    if (value !== undefined && value !== "task" && value !== "evidence") {
        throw new Error("--kind must be task or evidence.");
    }
    return value;
}
async function runLockSubcommand(argv) {
    if (hasHelpFlag(argv)) {
        console.log(TASK_LOCK_HELP_TEXT);
        return 0;
    }
    const [action, ...args] = argv;
    if (action !== "status" && action !== "recover") {
        throw new Error(TASK_LOCK_HELP_TEXT);
    }
    const knownFlags = new Set(["--kind", "--json", "--force"]);
    for (const arg of args) {
        if (arg.startsWith("-") && !knownFlags.has(arg)) {
            throw new Error(`Unknown option: ${arg}`);
        }
    }
    const positional = args.filter((arg, index) => !arg.startsWith("-") && args[index - 1] !== "--kind");
    if (positional.length > 0)
        throw new Error(TASK_LOCK_HELP_TEXT);
    if (action === "recover" && args.includes("--json"))
        throw new Error("--json is only valid with lock status.");
    if (action === "status" && args.includes("--force"))
        throw new Error("--force is only valid with lock recover.");
    const rootDirectory = resolve(process.cwd());
    const config = await readAgenticConfigFile(rootDirectory);
    const selectedKind = parseLockKind(args);
    const kinds = selectedKind ? [selectedKind] : ["task", "evidence"];
    if (action === "recover" && !selectedKind) {
        throw new Error("--kind is required for lock recover.");
    }
    const pathFor = (kind) => kind === "task"
        ? join(rootDirectory, config.taskDirectory, ".apk.lock")
        : join(rootDirectory, TASK_EVIDENCE_LOCK_PATH);
    if (action === "status") {
        const results = await Promise.all(kinds.map(async (kind) => ({
            kind,
            inspection: await inspectLocalMutationLock(pathFor(kind)),
        })));
        if (args.includes("--json")) {
            console.log(JSON.stringify(results, null, 2));
        }
        else {
            for (const result of results) {
                console.log(`${result.kind}: ${renderLocalLockInspection(result.inspection)}`);
            }
        }
        return results.some((result) => ["dead", "malformed", "uncertain"].includes(result.inspection.state)) ? 1 : 0;
    }
    const kind = selectedKind;
    const result = await recoverLocalLock({
        path: pathFor(kind),
        kind: kind === "task" ? "task-mutation" : "evidence-append",
        command: `task lock recover --kind ${kind}`,
        force: args.includes("--force"),
    });
    console.log(result.recovered
        ? `${kind}: recovered; ${renderLocalLockInspection(result.inspection)}`
        : `${kind}: unchanged; ${renderLocalLockInspection(result.inspection)}`);
    return 0;
}
async function runProvenanceSubcommand(argv) {
    if (hasHelpFlag(argv)) {
        console.log(TASK_PROVENANCE_HELP_TEXT);
        return 0;
    }
    for (const arg of argv) {
        if (arg.startsWith("-") && arg !== "--json") {
            throw new Error(`Unknown option: ${arg}`);
        }
    }
    const positional = argv.filter((arg) => !arg.startsWith("-"));
    if (positional.length !== 1) {
        throw new Error(TASK_PROVENANCE_HELP_TEXT);
    }
    const rootDirectory = resolve(process.cwd());
    const config = await readAgenticConfigFile(rootDirectory);
    const provenance = await buildTaskProvenance(rootDirectory, config.taskDirectory, positional[0]);
    if (argv.includes("--json")) {
        console.log(JSON.stringify(provenance, null, 2));
    }
    else {
        console.log(renderTaskProvenance(provenance));
    }
    return 0;
}
function parseDogfoodMetrics(value) {
    if (value === undefined)
        return undefined;
    let parsed;
    try {
        parsed = JSON.parse(value);
    }
    catch (error) {
        throw new Error(`--metrics-json must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("--metrics-json must contain a JSON object.");
    }
    return parsed;
}
function optionalCsvFlag(argv, flag) {
    const value = parseFlag(argv, flag);
    return value === undefined ? undefined : parseCsvFlag(value);
}
async function runDogfoodSubcommand(argv) {
    if (hasHelpFlag(argv)) {
        console.log(TASK_DOGFOOD_HELP_TEXT);
        return 0;
    }
    const [action, ...args] = argv;
    const knownFlags = action === "start"
        ? new Set(["--owner", "--tool", "--scenario", "--session", "--started-at", "--help", "-h"])
        : new Set(["--owner", "--session", "--outcome", "--ended-at", "--failures", "--retries", "--observations", "--issues", "--metrics-json", "--help", "-h"]);
    for (const arg of args) {
        if (arg.startsWith("-") && !knownFlags.has(arg)) {
            throw new Error(`Unknown option: ${arg}`);
        }
    }
    if (action !== "start" && action !== "result") {
        throw new Error(TASK_DOGFOOD_HELP_TEXT);
    }
    const positional = args.filter((arg, index) => (!arg.startsWith("-") &&
        args[index - 1] !== "--owner" &&
        args[index - 1] !== "--tool" &&
        args[index - 1] !== "--scenario" &&
        args[index - 1] !== "--session" &&
        args[index - 1] !== "--started-at" &&
        args[index - 1] !== "--outcome" &&
        args[index - 1] !== "--ended-at" &&
        args[index - 1] !== "--failures" &&
        args[index - 1] !== "--retries" &&
        args[index - 1] !== "--observations" &&
        args[index - 1] !== "--issues" &&
        args[index - 1] !== "--metrics-json"));
    if (positional.length !== 1) {
        throw new Error(TASK_DOGFOOD_HELP_TEXT);
    }
    const rootDirectory = resolve(process.cwd());
    const config = await readAgenticConfigFile(rootDirectory);
    const taskId = positional[0];
    const owner = parseFlag(args, "--owner");
    if (!owner) {
        throw new Error("--owner is required.");
    }
    if (action === "start") {
        const tool = parseFlag(args, "--tool");
        const scenario = parseFlag(args, "--scenario");
        if (!tool || !scenario) {
            throw new Error("--tool and --scenario are required.");
        }
        const session = await startDogfoodSession({
            rootDirectory,
            taskDirectory: config.taskDirectory,
            taskId,
            owner,
            tool,
            scenario,
            sessionId: parseFlag(args, "--session"),
            startedAt: parseFlag(args, "--started-at"),
        });
        console.log(renderDogfoodSession(session));
        return 0;
    }
    const sessionId = parseFlag(args, "--session");
    const outcome = parseFlag(args, "--outcome");
    if (!sessionId || !outcome) {
        throw new Error("--session and --outcome are required.");
    }
    if (outcome !== "pass" && outcome !== "fail") {
        throw new Error("--outcome must be pass or fail.");
    }
    const retriesValue = parseFlag(args, "--retries");
    let retries;
    if (retriesValue !== undefined) {
        const parsedRetries = Number.parseInt(retriesValue, 10);
        if (!Number.isInteger(parsedRetries) || parsedRetries < 0) {
            throw new Error("--retries must be a non-negative integer.");
        }
        retries = parsedRetries;
    }
    const result = await recordDogfoodResult({
        rootDirectory,
        taskDirectory: config.taskDirectory,
        taskId,
        owner,
        sessionId,
        outcome,
        endedAt: parseFlag(args, "--ended-at"),
        failures: optionalCsvFlag(args, "--failures"),
        retries,
        observations: optionalCsvFlag(args, "--observations"),
        issues: optionalCsvFlag(args, "--issues"),
        metrics: parseDogfoodMetrics(parseFlag(args, "--metrics-json")),
    });
    console.log(renderDogfoodResult(result));
    return result.outcome === "pass" ? 0 : 1;
}
async function runPolicySubcommand(argv) {
    if (hasHelpFlag(argv)) {
        console.log(TASK_POLICY_HELP_TEXT);
        return 0;
    }
    rejectUnknownOptions(argv);
    if (argv.length !== 1) {
        throw new Error("Usage: apk task policy <task-id>");
    }
    const rootDirectory = resolve(process.cwd());
    const config = await readAgenticConfigFile(rootDirectory);
    const taskPath = await findTaskFile(rootDirectory, argv[0], config.taskDirectory);
    const taskFile = await loadTaskFile(taskPath);
    console.log(renderTaskPolicy(resolveTaskPolicy(taskFile.task)));
    return 0;
}
async function runGateSubcommand(argv) {
    if (hasHelpFlag(argv)) {
        console.log(TASK_GATE_HELP_TEXT);
        return 0;
    }
    rejectUnknownOptions(argv);
    if (argv.length !== 1) {
        throw new Error("Usage: apk task gate <task-id>");
    }
    const rootDirectory = resolve(process.cwd());
    const config = await readAgenticConfigFile(rootDirectory);
    const result = await evaluateTaskCompletionGate({
        rootDirectory,
        taskDirectory: config.taskDirectory,
        taskId: argv[0],
    });
    console.log(renderTaskCompletionGate(result));
    return result.passed ? 0 : 1;
}
async function runVerifySubcommand(argv) {
    if (hasHelpFlag(argv)) {
        console.log(TASK_VERIFY_HELP_TEXT);
        return 0;
    }
    const recording = hasFlag(argv, "--record");
    const knownVerifyFlags = new Set([
        "--check-files-only", "--profile", "--owner", "--help", "-h",
        ...(recording ? ["--record", "--check", "--result", "--evidence", "--summary"] : []),
    ]);
    for (const arg of argv) {
        if (arg.startsWith("-") && !knownVerifyFlags.has(arg)) {
            throw new Error(`Unknown option: ${arg}`);
        }
    }
    const valueFlags = new Set(recording
        ? ["--owner", "--profile", "--check", "--result", "--evidence", "--summary"]
        : ["--owner", "--profile"]);
    const positional = argv.filter((arg, index) => (!arg.startsWith("-") && !valueFlags.has(argv[index - 1] ?? "")));
    if (positional.length !== 1) {
        throw new Error("Usage: apk task verify <task-id> [--check-files-only] [--owner <agent-id>]");
    }
    const rootDirectory = resolve(process.cwd());
    const config = await readAgenticConfigFile(rootDirectory);
    if (recording) {
        const owner = parseFlag(argv, "--owner");
        if (!owner) {
            throw new Error("--owner is required for --record.");
        }
        const result = await recordManualVerification({
            rootDirectory,
            taskDirectory: config.taskDirectory,
            taskId: positional[0],
            owner,
            checkId: parseFlag(argv, "--check") ?? "",
            result: (parseFlag(argv, "--result") ?? ""),
            evidence: parseFlag(argv, "--evidence") ?? "",
            summary: parseFlag(argv, "--summary"),
        });
        console.log(renderRecordManualVerificationResult(result));
        return result.result === "pass" ? 0 : 1;
    }
    const profile = parseFlag(argv, "--profile");
    if (profile !== undefined &&
        profile !== "all" &&
        !TASK_VERIFICATION_PROFILES.includes(profile)) {
        throw new Error(`--profile must be one of: all, ${TASK_VERIFICATION_PROFILES.join(", ")}.`);
    }
    const result = await verifyTask({
        rootDirectory,
        taskDirectory: config.taskDirectory,
        taskId: positional[0],
        owner: parseFlag(argv, "--owner"),
        checkFilesOnly: hasFlag(argv, "--check-files-only"),
        profile: profile,
    });
    console.log(renderTaskVerifyResult(result));
    return result.passed ? 0 : 1;
}
export async function runTaskCommand(argv) {
    try {
        if (argv.length === 0) {
            console.error("Error: Usage: apk task <archive|deps|evidence|lock|policy|gate|dogfood|verify|create>");
            return 1;
        }
        const [subcommand, ...subArgs] = argv;
        if (subcommand === "--help" || subcommand === "-h") {
            console.log(TASK_HELP_TEXT);
            return 0;
        }
        if (subcommand === "archive") {
            return await runArchiveSubcommand(subArgs);
        }
        if (subcommand === "deps") {
            return await runDepsSubcommand(subArgs);
        }
        if (subcommand === "verify") {
            return await runVerifySubcommand(subArgs);
        }
        if (subcommand === "evidence") {
            return await runEvidenceSubcommand(subArgs);
        }
        if (subcommand === "lock") {
            return await runLockSubcommand(subArgs);
        }
        if (subcommand === "dogfood") {
            return await runDogfoodSubcommand(subArgs);
        }
        if (subcommand === "provenance") {
            return await runProvenanceSubcommand(subArgs);
        }
        if (subcommand === "policy") {
            return await runPolicySubcommand(subArgs);
        }
        if (subcommand === "gate") {
            return await runGateSubcommand(subArgs);
        }
        if (subcommand === "create") {
            return await runCreateSubcommand(subArgs);
        }
        console.error(`Error: Unknown task subcommand: ${subcommand}`);
        return 1;
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 1;
    }
}
