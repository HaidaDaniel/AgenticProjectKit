import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderTemplateFile, type TemplateData } from "../templates/index.js";

export const MINIMAL_DOC_TEMPLATE_IDS = [
  "project",
  "scope",
  "architecture",
] as const;

export type MinimalDocTemplateId = (typeof MINIMAL_DOC_TEMPLATE_IDS)[number];

export interface MinimalDocTemplate {
  id: MinimalDocTemplateId;
  outputPath: string;
  templatePath: string;
}

export interface GeneratedMinimalDoc {
  id: MinimalDocTemplateId;
  outputPath: string;
  content: string;
}

const docsDirectory = dirname(fileURLToPath(import.meta.url));
const sourceDirectory = dirname(docsDirectory);
const templateDirectory = join(sourceDirectory, "templates", "minimal-docs");

const MINIMAL_DOC_TEMPLATES: readonly MinimalDocTemplate[] = [
  {
    id: "project",
    outputPath: "docs/project.md",
    templatePath: join(templateDirectory, "project.md.hbs"),
  },
  {
    id: "scope",
    outputPath: "docs/scope.md",
    templatePath: join(templateDirectory, "scope.md.hbs"),
  },
  {
    id: "architecture",
    outputPath: "docs/architecture.md",
    templatePath: join(templateDirectory, "architecture.md.hbs"),
  },
];

export function listMinimalDocTemplates(): readonly MinimalDocTemplate[] {
  return MINIMAL_DOC_TEMPLATES;
}

export async function renderMinimalDoc(
  id: MinimalDocTemplateId,
  data: TemplateData,
): Promise<GeneratedMinimalDoc> {
  const template = MINIMAL_DOC_TEMPLATES.find((entry) => entry.id === id);

  if (!template) {
    throw new Error(`Unknown minimal doc template: ${id}`);
  }

  return {
    id: template.id,
    outputPath: template.outputPath,
    content: await renderTemplateFile(template.templatePath, { data }),
  };
}

export async function renderMinimalDocs(
  dataByTemplate: Record<MinimalDocTemplateId, TemplateData>,
): Promise<GeneratedMinimalDoc[]> {
  const docs: GeneratedMinimalDoc[] = [];

  for (const template of MINIMAL_DOC_TEMPLATES) {
    docs.push(await renderMinimalDoc(template.id, dataByTemplate[template.id]));
  }

  return docs;
}
