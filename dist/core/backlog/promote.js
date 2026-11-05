import { createHash, randomUUID } from "node:crypto";
import { rename, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { createTaskUnderTaskLock, listArchivedTaskFiles, listTaskFiles, withTaskMutationLock, } from "../tasks/index.js";
import { backlogDirectory, listBacklogItems, readBacklogCardSnapshot, renderBacklogMarkdown, } from "./index.js";
export const PROMOTION_REASON_MAX_LENGTH = 2048;
export class BacklogPromotionError extends Error {
    issues;
    constructor(issues) {
        super(`Backlog promotion refused:\n- ${issues.join("\n- ")}`);
        this.name = "BacklogPromotionError";
        this.issues = issues;
    }
}
function missingTaskFields(task) {
    const missing = [];
    if (task.scope.length === 0)
        missing.push("scope");
    if (task.contextFiles.length === 0)
        missing.push("context");
    if (task.allowedFiles.length === 0)
        missing.push("allowed");
    if ((task.verification?.length ?? 0) === 0 && (task.verificationCommands?.length ?? 0) === 0)
        missing.push("verification");
    if (task.steps.length === 0)
        missing.push("steps");
    if (task.acceptanceCriteria.length === 0)
        missing.push("acceptance");
    return missing;
}
export function criteriaFingerprint(item) {
    return createHash("sha256")
        .update(JSON.stringify({ id: item.id, criteria: item.promotionCriteria.map((criterion) => [criterion.id, criterion.text]) }), "utf8")
        .digest("hex");
}
function markerFor(item) {
    return `(Backlog-Id: ${item.id})`;
}
function sourceReference(item) {
    return `Source backlog: ${item.path} ${markerFor(item)}`;
}
function normalizedReason(reason) {
    if (reason === undefined)
        return undefined;
    const normalized = reason.replace(/\s+/g, " ").trim();
    return normalized.length > 0 ? normalized : undefined;
}
async function findPromotedTasks(rootDirectory, taskDirectory, item) {
    const files = [
        ...await listTaskFiles(rootDirectory, taskDirectory),
        ...await listArchivedTaskFiles(rootDirectory, taskDirectory),
    ];
    const marker = markerFor(item);
    const matches = files.filter(({ task }) => task.notes.some((note) => note.startsWith("Source backlog:") && note.includes(marker)));
    return {
        tasks: matches.map((match) => ({
            id: match.task.id,
            path: relative(rootDirectory, match.path).replace(/\\/g, "/"),
        })),
        diagnostics: matches.length > 1
            ? [`Multiple tasks carry the same Backlog-Id backlink: ${matches.map((match) => match.task.id).join(", ")}.`]
            : [],
    };
}
function confirmationReview(item, confirmations, reason, expectedFingerprint) {
    const duplicateConfirmations = [...new Set(confirmations.filter((id, index) => confirmations.indexOf(id) !== index))];
    const requested = new Set(confirmations);
    const criteria = new Set(item.promotionCriteria.map((criterion) => criterion.id));
    const unknownCriteria = [...requested].filter((id) => !criteria.has(id));
    const confirmedCriteria = item.promotionCriteria
        .filter((criterion) => requested.has(criterion.id))
        .map((criterion) => criterion.id);
    const missingCriteria = item.promotionCriteria
        .filter((criterion) => !requested.has(criterion.id))
        .map((criterion) => criterion.id);
    const diagnostics = [];
    if (missingCriteria.length > 0) {
        diagnostics.push(`Unconfirmed promotion criteria: ${missingCriteria.join(", ")}. Use --confirm <criterion-id> with an explicit operator reason.`);
    }
    if (unknownCriteria.length > 0)
        diagnostics.push(`Unknown promotion criteria: ${unknownCriteria.join(", ")}.`);
    if (duplicateConfirmations.length > 0)
        diagnostics.push(`Duplicate confirmation flags: ${duplicateConfirmations.join(", ")}.`);
    const normalized = normalizedReason(reason);
    if (confirmedCriteria.length > 0 && normalized === undefined) {
        diagnostics.push("Human-only criteria require an explicit --reason supplied by the operator.");
    }
    if (normalized !== undefined && normalized.length > PROMOTION_REASON_MAX_LENGTH) {
        diagnostics.push(`Promotion reason exceeds the ${PROMOTION_REASON_MAX_LENGTH} character limit.`);
    }
    const fingerprint = criteriaFingerprint(item);
    if (confirmedCriteria.length > 0 && !expectedFingerprint) {
        diagnostics.push("Criteria revision fingerprint is required with confirmations; rerun --preview and pass --expect-criteria.");
    }
    else if (expectedFingerprint !== undefined && expectedFingerprint !== fingerprint) {
        diagnostics.push("Promotion criteria changed since preview; review the current criteria and generate a fresh confirmation fingerprint.");
    }
    return { confirmedCriteria, missingCriteria, unknownCriteria, duplicateConfirmations, diagnostics };
}
async function buildPreview(rootDirectory, taskDirectory, slug, request) {
    const card = await readBacklogCardSnapshot(rootDirectory, taskDirectory, slug);
    const item = card.item;
    const diagnostics = [];
    const blocking = [];
    const missingFields = missingTaskFields(request.task);
    for (const field of missingFields) {
        const message = `Missing required task field: ${field}.`;
        diagnostics.push(message);
        blocking.push(message);
    }
    if (item.status === "discarded") {
        const message = "A discarded backlog card cannot be promoted.";
        diagnostics.push(message);
        blocking.push(message);
    }
    const confirmation = confirmationReview(item, request.confirmations, request.reason, request.expectedCriteriaFingerprint);
    diagnostics.push(...confirmation.diagnostics);
    blocking.push(...confirmation.diagnostics);
    const cardInventory = await listBacklogItems(rootDirectory, taskDirectory);
    if (cardInventory.diagnostics.length > 0) {
        const message = `Backlog inventory is not healthy: ${cardInventory.diagnostics.join("; ")}`;
        diagnostics.push(message);
        blocking.push(message);
    }
    const otherCards = cardInventory.items;
    const duplicateIds = otherCards.filter((card) => card.id === item.id && card.slug !== item.slug);
    if (duplicateIds.length > 0) {
        const message = `Backlog-Id ${item.id} is also used by: ${duplicateIds.map((card) => card.path).join(", ")}.`;
        diagnostics.push(message);
        blocking.push(message);
    }
    const taskReferences = await findPromotedTasks(rootDirectory, taskDirectory, item);
    diagnostics.push(...taskReferences.diagnostics);
    blocking.push(...taskReferences.diagnostics);
    const existingTask = taskReferences.tasks[0];
    if (item.status === "promoted") {
        if (!item.promotedTask) {
            const message = "Promoted card is missing its Promoted-Task id.";
            diagnostics.push(message);
            blocking.push(message);
        }
        else if (!existingTask) {
            const message = `Promoted card references Task ${item.promotedTask}, but no task carries the Backlog-Id backlink.`;
            diagnostics.push(message);
            blocking.push(message);
        }
        else if (existingTask.id !== item.promotedTask) {
            const message = `Promoted card references Task ${item.promotedTask}, but the backlink points to Task ${existingTask.id}.`;
            diagnostics.push(message);
            blocking.push(message);
        }
    }
    else if (existingTask) {
        diagnostics.push(`A task already references this Backlog-Id (${existingTask.id}); apply will repair the card without creating a duplicate.`);
    }
    return {
        item,
        cardRevision: card.revision,
        criteriaFingerprint: criteriaFingerprint(item),
        missingFields,
        ...confirmation,
        ...(existingTask ? { existingTask } : {}),
        diagnostics,
        valid: blocking.length === 0,
    };
}
export async function previewBacklogPromotion(rootDirectory, taskDirectory, slug, request) {
    return buildPreview(rootDirectory, taskDirectory, slug, request);
}
export async function writeBacklogCardWithRevision(rootDirectory, taskDirectory, item, expectedRevision) {
    const current = await readBacklogCardSnapshot(rootDirectory, taskDirectory, item.slug);
    if (current.revision !== expectedRevision) {
        throw new BacklogPromotionError(["Backlog card changed during promotion; review the current Markdown and retry without overwriting it."]);
    }
    const directory = backlogDirectory(rootDirectory, taskDirectory);
    const target = join(directory, `${item.slug}.md`);
    const temporary = join(directory, `.${item.slug}.${randomUUID()}.tmp`);
    await writeFile(temporary, renderBacklogMarkdown(item), { encoding: "utf8", flag: "wx" });
    try {
        // Residual boundary: an external writer can still replace the card after
        // this revision check but before rename. Check immediately before replace
        // and never claim stronger atomicity than the filesystem provides.
        const beforeRename = await readBacklogCardSnapshot(rootDirectory, taskDirectory, item.slug);
        if (beforeRename.revision !== expectedRevision) {
            throw new BacklogPromotionError(["Backlog card changed during promotion; review the current Markdown and retry without overwriting it."]);
        }
        await rename(temporary, target);
    }
    catch (error) {
        await rm(temporary, { force: true });
        throw error;
    }
}
export async function promoteBacklogItem(rootDirectory, taskDirectory, slug, request) {
    return withTaskMutationLock(rootDirectory, taskDirectory, "backlog promote", undefined, async () => {
        const preview = await buildPreview(rootDirectory, taskDirectory, slug, request);
        if (!preview.valid)
            throw new BacklogPromotionError(preview.diagnostics);
        const item = preview.item;
        if (preview.existingTask) {
            if (item.status === "promoted" && item.promotedTask === preview.existingTask.id) {
                const existing = await listTaskFiles(rootDirectory, taskDirectory);
                const archived = await listArchivedTaskFiles(rootDirectory, taskDirectory);
                const task = [...existing, ...archived].find(({ task }) => task.id === preview.existingTask.id);
                if (!task)
                    throw new BacklogPromotionError([`Task ${preview.existingTask.id} disappeared during promotion.`]);
                return {
                    outcome: "already-promoted",
                    item,
                    task: {
                        id: task.task.id,
                        path: relative(rootDirectory, task.path).replace(/\\/g, "/"),
                        task: task.task,
                    },
                };
            }
            const promoted = { ...item, status: "promoted", promotedTask: preview.existingTask.id };
            await writeBacklogCardWithRevision(rootDirectory, taskDirectory, promoted, preview.cardRevision);
            return {
                outcome: "recovered",
                item: promoted,
                task: {
                    id: preview.existingTask.id,
                    path: preview.existingTask.path,
                    task: (await listTaskFiles(rootDirectory, taskDirectory)).find(({ task }) => task.id === preview.existingTask.id)?.task
                        ?? (await listArchivedTaskFiles(rootDirectory, taskDirectory)).find(({ task }) => task.id === preview.existingTask.id).task,
                },
            };
        }
        const notes = [
            ...request.task.notes,
            sourceReference(item),
            ...(preview.confirmedCriteria.length > 0
                ? [`Backlog promotion confirmation: operator-asserted criteria ${preview.confirmedCriteria.join(", ")}; reason: ${normalizedReason(request.reason)}`]
                : []),
        ];
        const goal = request.task.goal.replace(/\s+/g, " ").trim()
            || (item.proposedOutcome !== "Not recorded yet." ? item.proposedOutcome.replace(/\s+/g, " ").trim() : item.title);
        const created = await createTaskUnderTaskLock(rootDirectory, taskDirectory, {
            ...request.task,
            title: item.title,
            goal,
            documentationUpdates: request.task.documentationUpdates.length > 0
                ? request.task.documentationUpdates
                : ["Update docs/progress.md when task state changes."],
            notes,
        });
        const promoted = { ...item, status: "promoted", promotedTask: created.id };
        await writeBacklogCardWithRevision(rootDirectory, taskDirectory, promoted, preview.cardRevision);
        return { outcome: "promoted", item: promoted, task: created };
    }, { timeoutMs: 10_000, retryMs: 25 });
}
