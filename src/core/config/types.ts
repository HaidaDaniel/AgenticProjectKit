export const OPERATING_MODES = [
  "discovery",
  "mvp",
  "product",
  "production",
  "maintenance",
  "audit",
  "adopt",
] as const;

export type OperatingMode = (typeof OPERATING_MODES)[number];

export const DOCUMENTATION_PROFILES = [
  "minimal",
  "standard",
  "production",
] as const;

export type DocumentationProfile = (typeof DOCUMENTATION_PROFILES)[number];

export const AGENT_STYLES = ["caveman", "normal"] as const;

export type AgentStyle = (typeof AGENT_STYLES)[number];

export interface AgenticConfig {
  projectName: string;
  defaultMode: OperatingMode;
  documentationProfile: DocumentationProfile;
  agentStyle: AgentStyle;
  taskDirectory: string;
  docsDirectory: string;
}

