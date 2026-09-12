import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { readAgenticConfigFile } from "../config/index.js";
import { detectQualityCapabilities } from "../quality/index.js";
import { emptyResourceRegistry } from "./index.js";
export const RESOURCE_INVENTORY_SCHEMA_VERSION = 1;
export const RESOURCE_DETECTION_AVAILABILITIES = ["declared", "detected", "unknown"];
// Deterministic, read-only harness/runtime markers. These only observe local
// files; detection never reads environment secrets, authenticates, or probes
// providers.
const HARNESS_MARKERS = [
    { id: "agents", paths: ["AGENTS.md"] },
    { id: "codex", paths: [".codex"] },
    { id: "opencode", paths: [".opencode", "opencode.json"] },
    { id: "claude", paths: ["CLAUDE.md"] },
    { id: "gemini", paths: ["GEMINI.md"] },
    { id: "cursor", paths: [".cursor"] },
];
const ENDPOINT_SECRET_SHAPE = /(api[_-]?key|secret|token|password|credential|bearer|authorization|private[_-]?key)/i;
const ENDPOINT_SECRET_QUERY = /[?&](?:key|auth)=/i;
const ENDPOINT_USERINFO_SHAPE = /\/\/[^/@\s]+:[^/@\s]*@/;
/** Endpoints are reported only when they carry no credential-shaped content. */
function sanitizeEndpoint(endpoint) {
    if (ENDPOINT_SECRET_SHAPE.test(endpoint)
        || ENDPOINT_SECRET_QUERY.test(endpoint)
        || ENDPOINT_USERINFO_SHAPE.test(endpoint)) {
        return undefined;
    }
    return endpoint;
}
async function exists(path) {
    try {
        await access(path);
        return true;
    }
    catch {
        return false;
    }
}
function compareResources(left, right) {
    return left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id) || left.source.localeCompare(right.source);
}
function inventoryFingerprint(resources, qualityCapabilities) {
    const stable = JSON.stringify({
        resources: [...resources].sort(compareResources),
        qualityCapabilities: [...qualityCapabilities].sort(),
    });
    return createHash("sha256").update(stable).digest("hex");
}
function declaredResources(registry) {
    const resources = [];
    for (const model of registry.models) {
        resources.push({
            id: model.id,
            kind: "model",
            availability: "declared",
            capabilities: [...model.roles].sort(),
            source: "config.resources.models",
        });
    }
    for (const harness of registry.harnesses) {
        resources.push({
            id: harness.id,
            kind: "harness",
            availability: "declared",
            capabilities: [...harness.tools].sort(),
            source: "config.resources.harnesses",
        });
    }
    for (const worker of registry.workers) {
        resources.push({
            id: worker.id,
            kind: "worker",
            availability: "declared",
            capabilities: [...worker.capabilities.roles].sort(),
            costClass: worker.costClass,
            capacity: worker.capacity,
            occupied: worker.occupied,
            location: worker.location,
            ...(worker.endpoint && sanitizeEndpoint(worker.endpoint) ? { endpoint: worker.endpoint } : {}),
            available: worker.availability === "available",
            source: "config.resources.workers",
        });
    }
    return resources;
}
async function detectedResources(rootDirectory) {
    const resources = [];
    for (const marker of HARNESS_MARKERS) {
        const matched = (await Promise.all(marker.paths.map((path) => exists(join(rootDirectory, path)))))
            .some(Boolean);
        if (matched) {
            resources.push({
                id: marker.id,
                kind: "harness",
                availability: "detected",
                capabilities: [],
                source: `marker:${marker.paths.join("|")}`,
            });
        }
    }
    return resources;
}
/**
 * Deterministic, read-only resource inventory. It merges declared resources,
 * local harness markers, and the shared Task 0077 quality capabilities. It
 * never reads or persists secrets and never performs provider login or
 * network probing. The fingerprint excludes the observation timestamp so
 * repeated runs over identical input are stable.
 */
export async function detectResourceInventory(rootDirectory) {
    const config = await readAgenticConfigFile(rootDirectory);
    const registry = config.resources ?? emptyResourceRegistry();
    const quality = await detectQualityCapabilities(rootDirectory, config.quality);
    const qualityCapabilities = quality.capabilities
        .filter((capability) => capability.status === "detected")
        .map((capability) => capability.id)
        .sort();
    const declared = declaredResources(registry);
    const detected = await detectedResources(rootDirectory);
    const qualityResources = qualityCapabilities.map((id) => ({
        id,
        kind: "quality",
        availability: "detected",
        capabilities: [id],
        source: "quality-detect",
    }));
    const seen = new Set(declared.map((resource) => `${resource.kind}:${resource.id}`));
    const resources = [
        ...declared,
        ...detected.filter((resource) => !seen.has(`${resource.kind}:${resource.id}`)),
        ...qualityResources,
    ].sort(compareResources);
    return {
        schemaVersion: RESOURCE_INVENTORY_SCHEMA_VERSION,
        fingerprint: inventoryFingerprint(resources, qualityCapabilities),
        resources,
        qualityCapabilities,
        diagnostics: [...quality.diagnostics],
    };
}
export function renderResourceInventory(inventory, json = false) {
    if (json) {
        return `${JSON.stringify(inventory, null, 2)}\n`;
    }
    const lines = [
        `Resource inventory (${inventory.resources.length} entries)`,
        `Fingerprint: ${inventory.fingerprint}`,
        `Quality capabilities: ${inventory.qualityCapabilities.join(", ") || "none"}`,
        "Resources:",
        ...(inventory.resources.length > 0
            ? inventory.resources.map((resource) => (`  - ${resource.kind} ${resource.id} [${resource.availability}]${resource.costClass ? ` cost=${resource.costClass}` : ""}${resource.capacity !== undefined ? ` capacity=${resource.capacity}` : ""} source=${resource.source}`))
            : ["  - none"]),
    ];
    if (inventory.diagnostics.length > 0) {
        lines.push("Diagnostics:", ...inventory.diagnostics.map((diagnostic) => `  - ${diagnostic}`));
    }
    lines.push("");
    return lines.join("\n");
}
