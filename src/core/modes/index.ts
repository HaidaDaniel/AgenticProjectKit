import {
  OPERATING_MODES,
  readAgenticConfigFile,
  writeAgenticConfigFile,
  type OperatingMode,
} from "../config/index.js";

export class ModeValidationError extends Error {
  constructor(mode: string) {
    super(`Invalid mode: ${mode}. Expected one of: ${OPERATING_MODES.join(", ")}.`);
    this.name = "ModeValidationError";
  }
}

export function parseOperatingMode(mode: string): OperatingMode {
  if ((OPERATING_MODES as readonly string[]).includes(mode)) {
    return mode as OperatingMode;
  }

  throw new ModeValidationError(mode);
}

export async function getProjectMode(rootDirectory: string): Promise<OperatingMode> {
  const config = await readAgenticConfigFile(rootDirectory);
  return config.defaultMode;
}

export async function setProjectMode(
  rootDirectory: string,
  mode: string,
): Promise<OperatingMode> {
  const nextMode = parseOperatingMode(mode);
  const config = await readAgenticConfigFile(rootDirectory);

  await writeAgenticConfigFile(rootDirectory, {
    ...config,
    defaultMode: nextMode,
  });

  return nextMode;
}
