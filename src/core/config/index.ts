export {
  DEFAULT_CONFIG,
} from "./defaults.js";
export {
  ConfigValidationError,
} from "./errors.js";
export {
  CONFIG_PATH,
  readAgenticConfigFile,
  writeAgenticConfigFile,
} from "./file.js";
export {
  parseAgenticConfig,
  parseAgenticConfigJson,
  serializeAgenticConfig,
} from "./schema.js";
export {
  CONFIG_SCHEMA_VERSIONS,
  CURRENT_CONFIG_SCHEMA_VERSION,
  LEGACY_CONFIG_SCHEMA_VERSION,
} from "./schema.js";
export {
  detectCompatibility,
  type CompatibilityConfigState,
  type CompatibilityOverallState,
  type CompatibilityReport,
  type CompatibilityTaskContract,
} from "./compatibility.js";
export {
  AGENT_STYLES,
  DOCUMENTATION_PROFILES,
  OPERATING_MODES,
  type AgentStyle,
  type AgenticConfig,
  type DocumentationProfile,
  type OperatingMode,
} from "./types.js";
