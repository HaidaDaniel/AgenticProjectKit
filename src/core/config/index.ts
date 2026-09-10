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
export {
  emptyResourceRegistry,
  parseResourceRegistry,
  renderResourceRegistry,
  serializeResourceRegistry,
  ResourceRegistryValidationError,
  RESOURCE_AVAILABILITIES,
  RESOURCE_BILLING_MODES,
  RESOURCE_COST_CLASSES,
  RESOURCE_LOCATIONS,
  RESOURCE_WORKSPACE_MODES,
  type ResourceAvailability,
  type ResourceBillingMode,
  type ResourceCapabilities,
  type ResourceCostClass,
  type ResourceHarness,
  type ResourceLocation,
  type ResourceModel,
  type ResourceRegistry,
  type ResourceWorkspaceMode,
  type WorkerResource,
} from "../resources/index.js";
