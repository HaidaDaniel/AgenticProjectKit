import { readFile } from "node:fs/promises";
import Handlebars from "handlebars";
export async function loadTemplate(path) {
    return readFile(path, "utf8");
}
export function renderTemplate(template, options = {}) {
    const compiled = Handlebars.compile(template, {
        noEscape: true,
        strict: true,
    });
    return compiled(options.data ?? {});
}
export async function renderTemplateFile(path, options = {}) {
    const template = await loadTemplate(path);
    return renderTemplate(template, options);
}
