import { WORKER_PROTOCOL } from "../work/contract.js";

export const RESOURCE_COST_CLASSES = [
  "local-free",
  "cheap",
  "standard",
  "scarce-frontier",
] as const;
export type ResourceCostClass = (typeof RESOURCE_COST_CLASSES)[number];

export const RESOURCE_LOCATIONS = ["local", "remote"] as const;
export type ResourceLocation = (typeof RESOURCE_LOCATIONS)[number];

export const RESOURCE_BILLING_MODES = ["free", "metered", "subscription"] as const;
export type ResourceBillingMode = (typeof RESOURCE_BILLING_MODES)[number];

export const RESOURCE_AVAILABILITIES = ["available", "unavailable", "unknown"] as const;
export type ResourceAvailability = (typeof RESOURCE_AVAILABILITIES)[number];

export const RESOURCE_WORKSPACE_MODES = ["single-worktree", "isolated-worktree", "none"] as const;
export type ResourceWorkspaceMode = (typeof RESOURCE_WORKSPACE_MODES)[number];

export interface ResourceCapabilities {
  roles: string[];
  contextLimit?: number;
  tools: string[];
  workspaceModes: ResourceWorkspaceMode[];
  workerProtocols: string[];
}

export interface ResourceModel {
  id: string;
  family?: string;
  contextLimit?: number;
  roles: string[];
  reasoning?: boolean;
  coding?: boolean;
  review?: boolean;
}

export interface ResourceHarness {
  id: string;
  kind?: string;
  tools: string[];
  workspaceModes: ResourceWorkspaceMode[];
  sessionIsolation: boolean;
  subagentSupport: boolean;
  workerProtocols: string[];
}

export interface WorkerResource {
  id: string;
  modelId: string;
  harnessId: string;
  endpoint?: string;
  runtimeRef?: string;
  location: ResourceLocation;
  billingMode: ResourceBillingMode;
  costClass: ResourceCostClass;
  availability: ResourceAvailability;
  capacity: number;
  occupied: number;
  capabilities: ResourceCapabilities;
}

export interface ResourceRegistry {
  models: ResourceModel[];
  harnesses: ResourceHarness[];
  workers: WorkerResource[];
}

export class ResourceRegistryValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid resource registry:\n- ${issues.join("\n- ")}`);
    this.name = "ResourceRegistryValidationError";
    this.issues = issues;
  }
}

const MAX_ITEMS = 128;
const MAX_STRING = 240;
const SECRET_FIELD = /(api[_-]?key|access[_-]?token|client[_-]?secret|credential|password|private[_-]?key|secret|token)/i;
const SECRET_QUERY = /(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|secret|token)=/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, label: string, issues: string[], maxLength = MAX_STRING): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${label} must be a non-empty string.`);
    return "";
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    issues.push(`${label} must be at most ${maxLength} characters.`);
  }
  if (normalized.includes("\n") || normalized.includes("\r")) {
    issues.push(`${label} must be single-line.`);
  }
  return normalized;
}

function optionalText(value: unknown, label: string, issues: string[]): string | undefined {
  return value === undefined ? undefined : text(value, label, issues);
}

function boundedStrings(value: unknown, label: string, issues: string[], maxItems = 64): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    issues.push(`${label} must be an array.`);
    return [];
  }
  if (value.length > maxItems) {
    issues.push(`${label} must contain at most ${maxItems} items.`);
  }
  return value.slice(0, maxItems).map((item, index) => text(item, `${label}[${index}]`, issues));
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
  issues: string[],
  fallback: T,
): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    issues.push(`${label} must be one of: ${allowed.join(", ")}.`);
    return fallback;
  }
  return value as T;
}

function positiveInteger(value: unknown, label: string, issues: string[], fallback: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0 || value > 1_000_000) {
    issues.push(`${label} must be a positive integer at most 1000000.`);
    return fallback;
  }
  return value;
}

function nonNegativeInteger(value: unknown, label: string, issues: string[], fallback: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 1_000_000) {
    issues.push(`${label} must be a non-negative integer at most 1000000.`);
    return fallback;
  }
  return value;
}

function booleanValue(value: unknown, label: string, issues: string[], fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    issues.push(`${label} must be a boolean.`);
    return fallback;
  }
  return value;
}

function inspectSecrets(value: unknown, path: string, issues: string[], seen = new Set<object>()): void {
  if (typeof value === "string") {
    if (SECRET_QUERY.test(value)) {
      issues.push(`${path} must not contain secret material.`);
    }
    return;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectSecrets(item, `${path}[${index}]`, issues, seen));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`;
    if (SECRET_FIELD.test(key)) {
      issues.push(`${nestedPath} is not allowed; credentials and secrets are not persisted.`);
    }
    inspectSecrets(nested, nestedPath, issues, seen);
  }
}

function capabilities(value: unknown, label: string, issues: string[]): ResourceCapabilities {
  if (value !== undefined && !isRecord(value)) {
    issues.push(`${label} must be an object.`);
    return { roles: [], tools: [], workspaceModes: [], workerProtocols: [WORKER_PROTOCOL] };
  }
  const raw = (value ?? {}) as Record<string, unknown>;
  const rawWorkspaceModes = boundedStrings(raw.workspaceModes, `${label}.workspaceModes`, issues);
  if (rawWorkspaceModes.some((item) => !(RESOURCE_WORKSPACE_MODES as readonly string[]).includes(item))) {
    issues.push(`${label}.workspaceModes must contain only: ${RESOURCE_WORKSPACE_MODES.join(", ")}.`);
  }
  const workerProtocols = boundedStrings(raw.workerProtocols, `${label}.workerProtocols`, issues);
  const protocols = workerProtocols.length === 0 ? [WORKER_PROTOCOL] : workerProtocols;
  if (!protocols.includes(WORKER_PROTOCOL)) {
    issues.push(`${label}.workerProtocols must support ${WORKER_PROTOCOL}.`);
  }
  return {
    roles: boundedStrings(raw.roles, `${label}.roles`, issues),
    ...(raw.contextLimit === undefined ? {} : { contextLimit: positiveInteger(raw.contextLimit, `${label}.contextLimit`, issues, 1) }),
    tools: boundedStrings(raw.tools, `${label}.tools`, issues),
    workspaceModes: rawWorkspaceModes.filter((item): item is ResourceWorkspaceMode => (RESOURCE_WORKSPACE_MODES as readonly string[]).includes(item)),
    workerProtocols: protocols,
  };
}

function model(value: unknown, index: number, issues: string[]): ResourceModel {
  const label = `resources.models[${index}]`;
  if (!isRecord(value)) {
    issues.push(`${label} must be an object.`);
    return { id: "", roles: [] };
  }
  const result: ResourceModel = {
    id: text(value.id, `${label}.id`, issues),
    ...(value.family === undefined ? {} : { family: text(value.family, `${label}.family`, issues) }),
    ...(value.contextLimit === undefined ? {} : { contextLimit: positiveInteger(value.contextLimit, `${label}.contextLimit`, issues, 1) }),
    roles: boundedStrings(value.roles, `${label}.roles`, issues),
    ...(value.reasoning === undefined ? {} : { reasoning: booleanValue(value.reasoning, `${label}.reasoning`, issues, false) }),
    ...(value.coding === undefined ? {} : { coding: booleanValue(value.coding, `${label}.coding`, issues, false) }),
    ...(value.review === undefined ? {} : { review: booleanValue(value.review, `${label}.review`, issues, false) }),
  };
  return result;
}

function harness(value: unknown, index: number, issues: string[]): ResourceHarness {
  const label = `resources.harnesses[${index}]`;
  if (!isRecord(value)) {
    issues.push(`${label} must be an object.`);
    return { id: "", tools: [], workspaceModes: [], sessionIsolation: false, subagentSupport: false, workerProtocols: [WORKER_PROTOCOL] };
  }
  const protocols = boundedStrings(value.workerProtocols, `${label}.workerProtocols`, issues);
  const normalizedProtocols = protocols.length === 0 ? [WORKER_PROTOCOL] : protocols;
  if (!normalizedProtocols.includes(WORKER_PROTOCOL)) {
    issues.push(`${label}.workerProtocols must support ${WORKER_PROTOCOL}.`);
  }
  const rawWorkspaceModes = boundedStrings(value.workspaceModes, `${label}.workspaceModes`, issues);
  if (rawWorkspaceModes.some((item) => !(RESOURCE_WORKSPACE_MODES as readonly string[]).includes(item))) {
    issues.push(`${label}.workspaceModes must contain only: ${RESOURCE_WORKSPACE_MODES.join(", ")}.`);
  }
  return {
    id: text(value.id, `${label}.id`, issues),
    ...(value.kind === undefined ? {} : { kind: text(value.kind, `${label}.kind`, issues) }),
    tools: boundedStrings(value.tools, `${label}.tools`, issues),
    workspaceModes: rawWorkspaceModes.filter((item): item is ResourceWorkspaceMode => (RESOURCE_WORKSPACE_MODES as readonly string[]).includes(item)),
    sessionIsolation: booleanValue(value.sessionIsolation, `${label}.sessionIsolation`, issues, false),
    subagentSupport: booleanValue(value.subagentSupport, `${label}.subagentSupport`, issues, false),
    workerProtocols: normalizedProtocols,
  };
}

function worker(value: unknown, index: number, issues: string[]): WorkerResource {
  const label = `resources.workers[${index}]`;
  if (!isRecord(value)) {
    issues.push(`${label} must be an object.`);
    return {
      id: "", modelId: "", harnessId: "", location: "local", billingMode: "free",
      costClass: "local-free", availability: "unknown", capacity: 1, occupied: 0,
      capabilities: { roles: [], tools: [], workspaceModes: [], workerProtocols: [WORKER_PROTOCOL] },
    };
  }
  const occupied = value.occupied === undefined
    ? 0
    : nonNegativeInteger(value.occupied, `${label}.occupied`, issues, 0);
  const capacity = positiveInteger(value.capacity, `${label}.capacity`, issues, 1);
  if (occupied > capacity) issues.push(`${label}.occupied must not exceed capacity.`);
  const endpoint = optionalText(value.endpoint, `${label}.endpoint`, issues);
  const runtimeRef = optionalText(value.runtimeRef, `${label}.runtimeRef`, issues);
  return {
    id: text(value.id, `${label}.id`, issues),
    modelId: text(value.modelId, `${label}.modelId`, issues),
    harnessId: text(value.harnessId, `${label}.harnessId`, issues),
    ...(endpoint === undefined ? {} : { endpoint }),
    ...(runtimeRef === undefined ? {} : { runtimeRef }),
    location: oneOf(value.location, RESOURCE_LOCATIONS, `${label}.location`, issues, "local"),
    billingMode: oneOf(value.billingMode, RESOURCE_BILLING_MODES, `${label}.billingMode`, issues, "free"),
    costClass: oneOf(value.costClass, RESOURCE_COST_CLASSES, `${label}.costClass`, issues, "local-free"),
    availability: oneOf(value.availability, RESOURCE_AVAILABILITIES, `${label}.availability`, issues, "unknown"),
    capacity,
    occupied,
    capabilities: capabilities(value.capabilities, `${label}.capabilities`, issues),
  };
}

function list(value: unknown, label: string, issues: string[]): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    issues.push(`${label} must be an array.`);
    return [];
  }
  if (value.length > MAX_ITEMS) issues.push(`${label} must contain at most ${MAX_ITEMS} items.`);
  return value.slice(0, MAX_ITEMS);
}

function duplicateIds(items: readonly { id: string }[], label: string, issues: string[], ids: Set<string>): void {
  for (const item of items) {
    if (item.id.length === 0) continue;
    if (ids.has(item.id)) issues.push(`${label} contains duplicate id: ${item.id}.`);
    ids.add(item.id);
  }
}

export function emptyResourceRegistry(): ResourceRegistry {
  return { models: [], harnesses: [], workers: [] };
}

export function parseResourceRegistry(value: unknown): ResourceRegistry {
  if (value === undefined || value === null) return emptyResourceRegistry();
  if (!isRecord(value)) throw new ResourceRegistryValidationError(["resources must be an object."]);
  const issues: string[] = [];
  inspectSecrets(value, "resources", issues);
  const models = list(value.models, "resources.models", issues).map((item, index) => model(item, index, issues));
  const harnesses = list(value.harnesses, "resources.harnesses", issues).map((item, index) => harness(item, index, issues));
  const workers = list(value.workers, "resources.workers", issues).map((item, index) => worker(item, index, issues));
  const ids = new Set<string>();
  duplicateIds(models, "resources", issues, ids);
  duplicateIds(harnesses, "resources", issues, ids);
  duplicateIds(workers, "resources", issues, ids);
  const modelIds = new Set(models.map((item) => item.id));
  const harnessIds = new Set(harnesses.map((item) => item.id));
  for (const item of workers) {
    if (item.modelId && !modelIds.has(item.modelId)) issues.push(`resources.workers.${item.id}.modelId references missing model: ${item.modelId}.`);
    if (item.harnessId && !harnessIds.has(item.harnessId)) issues.push(`resources.workers.${item.id}.harnessId references missing harness: ${item.harnessId}.`);
  }
  if (issues.length > 0) throw new ResourceRegistryValidationError([...new Set(issues)]);
  return {
    models: [...models].sort((left, right) => left.id.localeCompare(right.id)),
    harnesses: [...harnesses].sort((left, right) => left.id.localeCompare(right.id)),
    workers: [...workers].sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function serializeResourceRegistry(registry: ResourceRegistry): string {
  return `${JSON.stringify(parseResourceRegistry(registry), null, 2)}\n`;
}

export function renderResourceRegistry(registry: ResourceRegistry, json = false): string {
  const normalized = parseResourceRegistry(registry);
  if (json) return `${JSON.stringify(normalized, null, 2)}\n`;
  const lines = [
    "Resource registry (read-only)",
    `Models: ${normalized.models.length}`,
    ...normalized.models.map((item) => `- model ${item.id}${item.family ? ` family=${item.family}` : ""} roles=${item.roles.join(",") || "none"}`),
    `Harnesses: ${normalized.harnesses.length}`,
    ...normalized.harnesses.map((item) => `- harness ${item.id} protocols=${item.workerProtocols.join(",")}`),
    `Workers: ${normalized.workers.length}`,
    ...normalized.workers.map((item) => `- worker ${item.id} model=${item.modelId} harness=${item.harnessId} cost=${item.costClass} availability=${item.availability} capacity=${item.occupied}/${item.capacity}`),
  ];
  return `${lines.join("\n")}\n`;
}
