import { resolve } from "node:path";
import { DEFAULT_EXECUTION_PROFILE, emptyResourceRegistry, parseExecutionOverride, parseExecutionProfile, renderExecutionRoute, resolveExecutionRoute, EXECUTION_COMPLEXITIES, EXECUTION_ROLES, } from "../../core/config/index.js";
import { readAgenticConfigFile } from "../../core/config/index.js";
import { applyExecutionCalibration, buildCalibrationPackage, renderCalibrationPackage, renderCalibrationValidation, validateCalibrationRecommendation, ASSURANCE_LEVELS, } from "../../core/execution/calibrate.js";
import { detectResourceInventory } from "../../core/resources/detect.js";
import { findTaskFile, loadTaskFile } from "../../core/tasks/index.js";
import { resolveTaskPolicy } from "../../core/tasks/policy.js";
const HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    `  apk execution explain <task-id> --role ${EXECUTION_ROLES.join("|")} [--profile ${DEFAULT_EXECUTION_PROFILE}|local|balanced|abundant] [--resource <worker-id>] [--complexity simple|medium|complex] [--json]`,
    "  apk execution calibrate [--json]",
    "  apk execution calibrate --recommendation <json> [--apply]",
    "",
    "Explain a deterministic execution route without starting a worker or probing a provider.",
    "Calibrate emits a bounded planner package, validates an external recommendation, and applies only on explicit request.",
].join("\n");
function readFlagValue(argv, flag) {
    const index = argv.indexOf(flag);
    if (index === -1)
        return undefined;
    if (index === argv.length - 1 || argv[index + 1].startsWith("-"))
        throw new Error(`${flag} requires a value.`);
    return argv[index + 1];
}
function positionalArgs(argv) {
    const valueFlags = new Set(["--role", "--profile", "--resource", "--complexity"]);
    return argv.filter((arg, index) => !arg.startsWith("-") && !valueFlags.has(argv[index - 1] ?? ""));
}
function hasHelpFlag(argv) {
    return argv.includes("--help") || argv.includes("-h");
}
export async function runExecutionCommand(argv) {
    if (hasHelpFlag(argv)) {
        console.log(HELP_TEXT);
        return 0;
    }
    try {
        if (argv[0] === "calibrate") {
            const rootDirectory = resolve(process.cwd());
            const inventory = await detectResourceInventory(rootDirectory);
            const recommendationValue = readFlagValue(argv, "--recommendation");
            if (recommendationValue === undefined) {
                console.log(renderCalibrationPackage(buildCalibrationPackage(inventory), argv.includes("--json")));
                return 0;
            }
            let parsed;
            try {
                parsed = JSON.parse(recommendationValue);
            }
            catch (error) {
                throw new Error(`--recommendation must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
            }
            const validation = validateCalibrationRecommendation(parsed, inventory);
            console.log(renderCalibrationValidation(validation));
            if (!validation.ok || !validation.recommendation)
                return 1;
            if (argv.includes("--apply")) {
                const result = await applyExecutionCalibration(rootDirectory, validation.recommendation, inventory);
                console.log(result.written ? "Applied calibration recommendation." : "Calibration unchanged (idempotent).");
            }
            return 0;
        }
        if (argv[0] !== "explain")
            throw new Error(HELP_TEXT);
        const positional = positionalArgs(argv.slice(1));
        if (positional.length !== 1)
            throw new Error(HELP_TEXT);
        const roleValue = readFlagValue(argv, "--role");
        if (!roleValue || !EXECUTION_ROLES.includes(roleValue)) {
            throw new Error(`--role must be one of: ${EXECUTION_ROLES.join(", ")}.`);
        }
        const profileValue = readFlagValue(argv, "--profile");
        const complexityValue = readFlagValue(argv, "--complexity");
        if (complexityValue && !EXECUTION_COMPLEXITIES.includes(complexityValue)) {
            throw new Error(`--complexity must be one of: ${EXECUTION_COMPLEXITIES.join(", ")}.`);
        }
        const rootDirectory = resolve(process.cwd());
        const config = await readAgenticConfigFile(rootDirectory);
        const taskFile = await findTaskFile(rootDirectory, positional[0], config.taskDirectory);
        const { task } = await loadTaskFile(taskFile);
        const policy = resolveTaskPolicy(task).requirements;
        // Resolve calibration status first: only a current (fingerprint-matching)
        // calibration may influence the effective plan. Stale calibration is
        // reported and ignored.
        const calibration = config.executionCalibration;
        let calibrationStatus;
        if (calibration) {
            const inventory = await detectResourceInventory(rootDirectory);
            calibrationStatus = calibration.inventoryFingerprint === inventory.fingerprint ? "current" : "stale";
        }
        const currentCalibration = calibrationStatus === "current" ? calibration : undefined;
        const cliProfile = profileValue === undefined ? undefined : parseExecutionProfile(profileValue);
        const calibrationProfile = currentCalibration?.profile;
        const authoredProfile = config.executionProfile;
        const effectiveProfile = cliProfile ?? calibrationProfile ?? authoredProfile;
        const profileSource = cliProfile
            ? "cli"
            : calibrationProfile
                ? "calibration"
                : authoredProfile
                    ? "config"
                    : "default";
        const cliResource = readFlagValue(argv, "--resource");
        const override = cliResource === undefined
            ? config.executionOverrides
            : parseExecutionOverride({
                ...(config.executionOverrides ?? {}),
                resourceId: cliResource,
                allowProfileBypass: true,
            });
        const calibrationRoute = currentCalibration?.routes[roleValue];
        const assuranceFloor = currentCalibration?.assuranceMinimum
            && ASSURANCE_LEVELS.includes(currentCalibration.assuranceMinimum)
            ? currentCalibration.assuranceMinimum
            : undefined;
        const calibrationInfluence = calibration
            ? {
                status: calibrationStatus ?? "stale",
                planner: calibration.planner,
                inventoryFingerprint: calibration.inventoryFingerprint,
                ...(calibration.profile ? { profile: calibration.profile } : {}),
                ...(calibrationRoute ? { routeRecommendation: calibrationRoute } : {}),
                routeApplied: false,
                ...(assuranceFloor ? { assuranceMinimum: assuranceFloor } : {}),
                reason: calibrationStatus === "current"
                    ? "current calibration evaluated"
                    : "stale inventory fingerprint; calibration ignored for effective routing",
            }
            : undefined;
        const route = resolveExecutionRoute({
            profile: effectiveProfile,
            profileSource,
            role: roleValue,
            policy,
            registry: config.resources ?? emptyResourceRegistry(),
            ...(complexityValue === undefined ? {} : { complexity: complexityValue }),
            ...(override === undefined ? {} : { override }),
            ...(currentCalibration && calibrationRoute ? { calibrationRoute } : {}),
            ...(currentCalibration && assuranceFloor ? { assuranceFloor } : {}),
            ...(calibrationInfluence ? { calibration: calibrationInfluence } : {}),
        });
        const json = argv.includes("--json");
        if (json) {
            const payload = JSON.parse(renderExecutionRoute(route, true));
            if (calibration) {
                // `payload.calibration` is the bounded route influence (status, planner,
                // fingerprint, routeApplied, reason). `savedCalibration` preserves the
                // exact stored recommendation for transparency.
                payload.savedCalibration = { ...calibration, status: calibrationStatus };
            }
            console.log(JSON.stringify(payload, null, 2));
            return 0;
        }
        console.log(renderExecutionRoute(route, false));
        return 0;
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 1;
    }
}
