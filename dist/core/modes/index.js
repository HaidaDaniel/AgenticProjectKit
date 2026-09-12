import { OPERATING_MODES, readAgenticConfigFile, writeAgenticConfigFile, } from "../config/index.js";
export class ModeValidationError extends Error {
    constructor(mode) {
        super(`Invalid mode: ${mode}. Expected one of: ${OPERATING_MODES.join(", ")}.`);
        this.name = "ModeValidationError";
    }
}
export function parseOperatingMode(mode) {
    if (OPERATING_MODES.includes(mode)) {
        return mode;
    }
    throw new ModeValidationError(mode);
}
export async function getProjectMode(rootDirectory) {
    const config = await readAgenticConfigFile(rootDirectory);
    return config.defaultMode;
}
export async function setProjectMode(rootDirectory, mode) {
    const nextMode = parseOperatingMode(mode);
    const config = await readAgenticConfigFile(rootDirectory);
    await writeAgenticConfigFile(rootDirectory, {
        ...config,
        defaultMode: nextMode,
    });
    return nextMode;
}
