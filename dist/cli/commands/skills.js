import { resolve } from "node:path";
import { listPackagedSkills, materializePackagedSkill, readPackagedSkillContent, } from "../../core/skills/index.js";
const SKILLS_HELP_TEXT = [
    "Agentic Project Kit",
    "",
    "Usage:",
    "  apkit skills list [--json]",
    "  apkit skills show <skill> [--json]",
    "  apkit skills materialize <skill> [--apply] [--force] [--json]",
    "",
    "Materialization is preview-only by default. --apply writes the project-local",
    "`.agents/skills/<skill>/SKILL.md`; --force is required to replace a conflicting file.",
].join("\n");
function hasHelpFlag(argv) {
    return argv.includes("--help") || argv.includes("-h");
}
function formatSkill(skill) {
    return `- ${skill.id}: source=${skill.source} destination=${skill.destination}`;
}
function printMaterialization(result) {
    console.log(`Skill: ${result.skill.id}`);
    console.log(`Source: ${result.skill.source}`);
    console.log(`Destination: ${result.skill.destination}`);
    console.log(`Status: ${result.status}`);
    console.log(`Mode: ${result.applied ? "apply" : "preview"}`);
    console.log(result.written ? "Wrote project-local skill." : "No files written.");
    if (result.status === "customized-conflict") {
        console.log("A conflicting project-local file is preserved; use --apply --force only after reviewing it.");
    }
}
export async function runSkillsCommand(argv) {
    if (hasHelpFlag(argv)) {
        console.log(SKILLS_HELP_TEXT);
        return 0;
    }
    const action = argv[0] && !argv[0].startsWith("-") ? argv[0] : "list";
    const rest = action === "list" && argv[0]?.startsWith("-") ? argv : argv.slice(1);
    const json = rest.includes("--json");
    const cleanRest = rest.filter((arg) => arg !== "--json");
    if (action === "list") {
        if (cleanRest.length > 0) {
            console.error("Usage: apkit skills list [--json]");
            return 1;
        }
        try {
            const skills = await listPackagedSkills();
            if (json) {
                console.log(JSON.stringify({
                    skills: skills.map(({ id, source, destination }) => ({ id, source, destination })),
                }, null, 2));
            }
            else {
                console.log(`Packaged APK skills: ${skills.length}`);
                for (const skill of skills) {
                    console.log(formatSkill(skill));
                }
            }
            return 0;
        }
        catch (error) {
            console.error(error instanceof Error ? error.message : String(error));
            return 1;
        }
    }
    if (action === "show") {
        const positional = cleanRest.filter((arg) => !arg.startsWith("-"));
        if (positional.length !== 1 || cleanRest.some((arg) => arg.startsWith("-") && arg !== "--json")) {
            console.error("Usage: apkit skills show <skill> [--json]");
            return 1;
        }
        try {
            const result = await readPackagedSkillContent(positional[0]);
            if (json) {
                console.log(JSON.stringify({
                    id: result.skill.id,
                    source: result.skill.source,
                    destination: result.skill.destination,
                    content: result.content,
                }, null, 2));
            }
            else {
                console.log(`Source: ${result.skill.source}`);
                console.log(`Destination: ${result.skill.destination}`);
                console.log("");
                process.stdout.write(result.content);
            }
            return 0;
        }
        catch (error) {
            console.error(error instanceof Error ? error.message : String(error));
            return 1;
        }
    }
    if (action === "materialize") {
        const apply = cleanRest.includes("--apply");
        const force = cleanRest.includes("--force");
        const positional = cleanRest.filter((arg) => !arg.startsWith("-"));
        const knownFlags = new Set(["--apply", "--force", "--json"]);
        if (positional.length !== 1 ||
            cleanRest.some((arg) => arg.startsWith("-") && !knownFlags.has(arg)) ||
            (force && !apply)) {
            console.error("Usage: apkit skills materialize <skill> [--apply] [--force] [--json]");
            return 1;
        }
        try {
            const result = await materializePackagedSkill(resolve(process.cwd()), positional[0], { apply, force });
            if (json) {
                console.log(JSON.stringify({
                    id: result.skill.id,
                    source: result.skill.source,
                    destination: result.skill.destination,
                    status: result.status,
                    applied: result.applied,
                    written: result.written,
                }, null, 2));
            }
            else {
                printMaterialization(result);
            }
            return result.status === "customized-conflict" && apply ? 1 : 0;
        }
        catch (error) {
            console.error(error instanceof Error ? error.message : String(error));
            return 1;
        }
    }
    console.error(`Unknown skills action: ${action}`);
    console.error(SKILLS_HELP_TEXT);
    return 1;
}
