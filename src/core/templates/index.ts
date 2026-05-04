import { readFile } from "node:fs/promises";

import Handlebars from "handlebars";

export type TemplateData = Record<string, unknown>;

export interface RenderTemplateOptions {
  data?: TemplateData;
}

export async function loadTemplate(path: string): Promise<string> {
  return readFile(path, "utf8");
}

export function renderTemplate(
  template: string,
  options: RenderTemplateOptions = {},
): string {
  const compiled = Handlebars.compile(template, {
    noEscape: true,
    strict: true,
  });

  return compiled(options.data ?? {});
}

export async function renderTemplateFile(
  path: string,
  options: RenderTemplateOptions = {},
): Promise<string> {
  const template = await loadTemplate(path);
  return renderTemplate(template, options);
}
