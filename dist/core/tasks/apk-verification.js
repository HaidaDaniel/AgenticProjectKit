import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
export const TASK_APK_OPERATIONS = ["lint", "doctor", "sync-check", "status"];
async function currentApkIdentity() {
    const packagePath = resolve(dirname(fileURLToPath(import.meta.url)), "../../..", "package.json");
    let packageValue;
    try {
        packageValue = JSON.parse(await readFile(packagePath, "utf8"));
    }
    catch (error) {
        throw new Error(`Cannot resolve the running APK package identity from ${packagePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!packageValue || typeof packageValue !== "object") {
        throw new Error(`Cannot resolve the running APK package identity from ${packagePath}: package metadata is not an object.`);
    }
    const metadata = packageValue;
    if (typeof metadata.name !== "string" || typeof metadata.version !== "string") {
        throw new Error(`Cannot resolve the running APK package identity from ${packagePath}: name/version are missing.`);
    }
    // This identity deliberately describes the loaded implementation rather than
    // a shell path. The candidate subject supplies the repository revision and
    // the operation is dispatched inside the already-running APK process.
    return `${metadata.name}@${metadata.version}:current-process`;
}
/**
 * Execute only the read-only APK operations allowed in task verification.
 * Dynamic imports keep the task parser independent from the command modules;
 * no global executable or PATH lookup is used.
 */
export async function runTaskApkOperation(rootDirectory, operation) {
    const cwd = resolve(rootDirectory);
    let exitCode = 0;
    switch (operation) {
        case "lint": {
            const { lintRepositoryContracts } = await import("../audit/lint.js");
            const result = await lintRepositoryContracts(cwd);
            exitCode = result.hasErrors ? 1 : 0;
            break;
        }
        case "doctor": {
            const { runDoctor } = await import("../doctor/index.js");
            const result = await runDoctor(cwd);
            exitCode = result.ok ? 0 : 1;
            break;
        }
        case "sync-check": {
            const { syncAgentExports } = await import("../sync/index.js");
            const result = await syncAgentExports(cwd);
            exitCode = result.hasDrift ? 1 : 0;
            break;
        }
        case "status": {
            const { summarizeStatus } = await import("../status/index.js");
            await summarizeStatus(cwd);
            break;
        }
    }
    return {
        exitCode,
        resolvedApkIdentity: await currentApkIdentity(),
    };
}
