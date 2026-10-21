import { lstat, open, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
const PACKAGE = "agentic-project-kit";
const LOCAL_PAYLOAD = `node_modules/${PACKAGE}/dist/cli/index.js`;
async function localPath(root, path) {
    if (isAbsolute(path) || path.split(/[\\/]/).includes("..") || path.includes("\0"))
        return "unknown";
    try {
        const base = await realpath(root);
        const resolved = await realpath(join(root, path));
        const within = relative(base, resolved);
        if (isAbsolute(within) || /^\.\.(?:[/\\]|$)/.test(within))
            return "unknown";
        return (await lstat(resolved)).isFile() ? "present" : "unknown";
    }
    catch (error) {
        return error && typeof error === "object" && "code" in error && error.code === "ENOENT" ? "absent" : "unknown";
    }
}
async function readBounded(root, path, limit = 64 * 1024) {
    const status = await localPath(root, path);
    if (status !== "present")
        return { status };
    try {
        const file = await open(join(root, path), constants.O_RDONLY | constants.O_NONBLOCK);
        try {
            const info = await file.stat();
            if (!info.isFile() || info.size > limit)
                return { status: "unknown" };
            const data = Buffer.alloc(limit + 1);
            let size = 0;
            while (size < data.length) {
                const { bytesRead } = await file.read(data, size, data.length - size, size);
                if (!bytesRead)
                    break;
                size += bytesRead;
            }
            if (size > limit)
                return { status: "unknown" };
            return { status: "present", text: new TextDecoder("utf-8", { fatal: true }).decode(data.subarray(0, size)) };
        }
        finally {
            await file.close();
        }
    }
    catch {
        return { status: "unknown" };
    }
}
function object(text) {
    try {
        const value = JSON.parse(text);
        return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
    }
    catch {
        return undefined;
    }
}
function scalar(value) {
    const trimmed = value.trim();
    if (/^(?:"[^"\r\n]*"|'[^'\r\n]*')$/.test(trimmed))
        return trimmed.slice(1, -1);
    return /^[A-Za-z0-9@:/._+#()=-]+$/.test(trimmed) ? trimmed : undefined;
}
function exactPin(value) {
    return /^v?\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(value)
        || /^(?:github:|git\+https:\/\/|https:\/\/)[A-Za-z0-9/._-]+#(?:[a-f0-9]{40}|v?\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?)$/.test(value);
}
// Deliberately support only the conventional pnpm v9 root importer subset.
// Other YAML, aliases, duplicate roots/keys, and dynamic references stay unknown.
function inspectLock(text, pin) {
    text = text.replace(/\r\n/g, "\n");
    if ([...text.matchAll(/^lockfileVersion:/gm)].length !== 1 || [...text.matchAll(/^importers:/gm)].length !== 1
        || /:\s*[|>][+-]?\s*$/m.test(text) || /(?:^|\s)[&*][A-Za-z_]/m.test(text))
        return "unknown";
    if (!/^lockfileVersion: ['"]?9\.0['"]?\s*$/m.test(text))
        return "unknown";
    const roots = [...text.matchAll(/^  \.:\s*$/gm)];
    if (roots.length !== 1 || !/^importers:\s*$/m.test(text.slice(0, roots[0].index)))
        return "unknown";
    const after = text.slice(roots[0].index + roots[0][0].length);
    const end = after.search(/^\S|^  \S/m);
    const root = end < 0 ? after : after.slice(0, end);
    const scopes = [...root.matchAll(/^    ([A-Za-z]+):\s*$/gm)].map((match) => match[1]);
    if (new Set(scopes).size !== scopes.length)
        return "unknown";
    const entries = [...root.matchAll(/^      ['"]?agentic-project-kit['"]?:\s*\n((?:        .*(?:\n|$))*)/gm)];
    if (entries.length !== 1)
        return entries.length === 0 ? "mismatch" : "unknown";
    const scope = [...root.slice(0, entries[0].index).matchAll(/^    ([A-Za-z]+):\s*$/gm)].at(-1)?.[1];
    if (!scope || !["dependencies", "devDependencies", "optionalDependencies"].includes(scope))
        return "unknown";
    const block = entries[0][1];
    const specs = [...block.matchAll(/^        specifier: (.+)$/gm)];
    const versions = [...block.matchAll(/^        version: (.+)$/gm)];
    if (specs.length !== 1 || versions.length !== 1)
        return "unknown";
    const spec = scalar(specs[0][1]);
    const version = scalar(versions[0][1]);
    if (!spec || !version)
        return "unknown";
    if (spec !== pin)
        return "mismatch";
    // A version or full Git commit is a stable lock resolution, not proof that a tag
    // still resolves remotely or that the payload installs successfully.
    const expectedVersion = pin.match(/^v?(\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?)$/)?.[1];
    if (expectedVersion)
        return version === expectedVersion ? "matched" : "mismatch";
    const repo = pin.match(/^(?:github:|(?:git\+)?https:\/\/github\.com\/)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?#/)?.[1];
    const resolution = version.match(/^https:\/\/codeload\.github\.com\/([^/]+\/[^/]+)\/tar\.gz\/([a-f0-9]{40})$/);
    if (!repo || !resolution)
        return "unknown";
    if (resolution[1].toLowerCase() !== repo.toLowerCase())
        return "mismatch";
    const commit = resolution[2];
    if (!commit)
        return "unknown";
    const expectedCommit = pin.match(/#([a-f0-9]{40})$/)?.[1];
    return expectedCommit && expectedCommit !== commit ? "mismatch" : "matched";
}
export function renderInstallationFinding(finding) {
    return `${finding.code}: ${finding.message} Evidence: ${finding.paths.join(", ")}.`;
}
export async function inspectApkInstallation(rootDirectory) {
    const root = resolve(rootDirectory);
    const findings = [];
    const add = (code, message, paths, level = "warn") => findings.push({ code, level, message, paths });
    const report = { declared: "absent", locked: "not-applicable", present: await localPath(root, LOCAL_PAYLOAD), findings };
    const manifestRead = await readBounded(root, "package.json");
    const manifest = manifestRead.status === "present" ? object(manifestRead.text) : undefined;
    if (manifestRead.status === "unknown" || (manifestRead.status === "present" && !manifest)) {
        report.declared = "unknown";
        add("manifest-unknown", "Package declaration is malformed, external, unreadable, or exceeds 64 KiB; inspect it manually.", ["package.json"]);
    }
    const declarations = [];
    for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
        const group = manifest?.[field];
        if (group !== undefined && (!group || typeof group !== "object" || Array.isArray(group))) {
            report.declared = "unknown";
            add("declaration-unknown", "Dependency sections are malformed; inspect package metadata before choosing an installation path.", ["package.json"]);
        }
        if (group && typeof group === "object" && !Array.isArray(group) && PACKAGE in group)
            declarations.push(group[PACKAGE]);
    }
    let pin;
    if (declarations.length === 1 && typeof declarations[0] === "string") {
        pin = declarations[0];
        report.declared = exactPin(pin) ? "pinned" : "unfixed";
    }
    else if (declarations.length > 0) {
        report.declared = "unknown";
        add("declaration-unknown", "APK declaration is duplicated or not a string; reconcile package metadata.", ["package.json"]);
    }
    else if (manifest?.name === PACKAGE && await localPath(root, "dist/cli/index.js") === "present") {
        report.declared = "source-checkout";
        add("source-checkout", "APK source checkout: validate its committed build and dependency lock through the repository release workflow.", ["package.json"], "pass");
    }
    if (pin) {
        const lock = await readBounded(root, "pnpm-lock.yaml", 1024 * 1024);
        report.locked = lock.status === "present" ? inspectLock(lock.text, pin) : lock.status;
        const otherLocks = await Promise.all(["package-lock.json", "yarn.lock", "bun.lock", "bun.lockb"].map((path) => localPath(root, path)));
        if (otherLocks.some((status) => status !== "absent") || (typeof manifest?.packageManager === "string" && !manifest.packageManager.startsWith("pnpm@")))
            report.locked = "unknown";
        if (report.declared === "pinned" && report.locked === "matched") {
            add("pinned-declaration", "Exact APK declaration matches the supported root lock entry. This is reproducible metadata, not an observed install or launch.", ["package.json", "pnpm-lock.yaml"], "pass");
        }
        else {
            add("pin-unresolved", `APK declaration is ${report.declared}; lock evidence is ${report.locked}. Reconcile an exact source/version pin and lockfile manually; only pnpm v9 root importer metadata is inspected.`, ["package.json", "pnpm-lock.yaml"]);
        }
        if (report.present !== "present")
            add("local-payload-unavailable", `Local CLI payload is ${report.present}; perform the documented pinned install or inspect the external/symlinked target.`, [LOCAL_PAYLOAD]);
        const installed = await readBounded(root, `node_modules/${PACKAGE}/package.json`);
        const installedManifest = installed.status === "present" ? object(installed.text) : undefined;
        const version = installedManifest?.version;
        if (report.present === "present" && (installedManifest?.name !== PACKAGE || typeof version !== "string"))
            add("installed-identity-unknown", "CLI payload is present but package identity is not established; inspect installed metadata.", [LOCAL_PAYLOAD, `node_modules/${PACKAGE}/package.json`]);
        const expected = pin.match(/(?:^|#)v?(\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?)$/)?.[1];
        if (expected && typeof version === "string" && version !== expected)
            add("installed-version-mismatch", "Installed APK version disagrees with the exact declared version/tag; reconcile the local installation before using it.", ["package.json", `node_modules/${PACKAGE}/package.json`]);
    }
    let localInvocation = false;
    let wrapperInvocation = false;
    let externalPrerequisite = false;
    let externalPin = false;
    const docs = [];
    for (const path of ["README.md", "AGENTS.md"]) {
        const document = await readBounded(root, path);
        if (document.status === "unknown")
            add("instructions-unknown", "Installation instructions are unreadable, external, or exceed 64 KiB; inspect manually.", [path]);
        if (document.status !== "present")
            continue;
        docs.push(path);
        localInvocation ||= /\bpnpm\s+exec\s+(?:apk|apkit|agentic-project-kit)\b/.test(document.text);
        wrapperInvocation ||= /scripts\/apk\.sh/.test(document.text);
        externalPrerequisite ||= /(?:after installing (?:the )?(?:kit|APK|AgenticProjectKit)|(?:install|installed)\s+(?:APK|AgenticProjectKit)\s+(?:separately|globally)|(?:external|global)\s+(?:APK|AgenticProjectKit)\s+(?:installation|prerequisite))/i.test(document.text);
        externalPin ||= /(?:AgenticProjectKit|agentic-project-kit)[^\r\n]{0,100}(?:#v?\d+\.\d+\.\d+|\bv\d+\.\d+\.\d+)/i.test(document.text);
    }
    if (report.declared === "absent") {
        if (externalPrerequisite)
            add("external-prerequisite", `Instructions require a separate APK installation; ${externalPin ? "a version/source reference is present but acquisition is unverified" : "no supported exact version/source reference was found"}. Document a repeatable prerequisite or repository pin.`, docs);
        else
            add("installation-undeclared", "No repository APK declaration or recognized external prerequisite was found. Document a pinned installation; the running CLI or PATH is not clean-checkout evidence.", ["package.json", ...docs]);
    }
    if (docs.length === 0 && report.declared !== "source-checkout")
        add("installation-instructions-missing", "No readable README.md or AGENTS.md installation guidance was inspected; document the acquisition and invocation steps.", ["README.md", "AGENTS.md"]);
    if (localInvocation && report.declared !== "source-checkout" && (report.declared === "absent" || report.present !== "present"))
        add("local-invocation-unresolved", "Instructions use pnpm exec APK but a declared local CLI installation is not established; reconcile instructions and the pinned installation.", docs);
    const wrapper = await readBounded(root, "scripts/apk.sh");
    if (wrapper.status === "unknown")
        add("launcher-unknown", "Wrapper is unreadable, external, or exceeds 64 KiB; its target is unknown.", ["scripts/apk.sh"]);
    if (wrapper.status === "absent" && wrapperInvocation)
        add("launcher-missing", "Instructions reference an absent wrapper; restore it or update the documented invocation.", ["scripts/apk.sh", ...docs]);
    if (wrapper.status === "present") {
        const commands = wrapper.text.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith("#"));
        const literal = commands.length === 1 ? commands[0].match(/^\s*(?:exec\s+)?node\s+(?:"([^"$`]+)"|'([^']+)'|([^\s"'$`]+))(?:\s+"\$@")?\s*$/) : undefined;
        const target = literal?.slice(1).find(Boolean);
        if (!target)
            add("launcher-dynamic", "Wrapper target is dynamic or outside the supported single literal node command; inspect it manually without executing it.", ["scripts/apk.sh"]);
        else {
            const present = await localPath(root, target);
            if (present !== "present")
                add("launcher-payload-unavailable", `Literal wrapper payload is ${present}; restore the declared payload or reconcile the launcher.`, ["scripts/apk.sh", /^[A-Za-z0-9_. /-]{1,240}$/.test(target) ? target : "literal node target"]);
            if (localInvocation && resolve(root, target) !== resolve(root, LOCAL_PAYLOAD))
                add("launcher-disagreement", "Instructions use pnpm exec APK while the wrapper targets a different path; establish one documented source/version and reconcile both paths.", ["scripts/apk.sh", ...docs]);
        }
    }
    return report;
}
