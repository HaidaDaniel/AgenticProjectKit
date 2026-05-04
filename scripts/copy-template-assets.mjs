import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceDirectory = join(rootDirectory, "src", "core", "templates");
const targetDirectory = join(rootDirectory, "dist", "core", "templates");

async function copyHandlebarsTemplates(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      await copyHandlebarsTemplates(sourcePath);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".hbs")) {
      continue;
    }

    const targetPath = join(targetDirectory, relative(sourceDirectory, sourcePath));
    await mkdir(dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
  }
}

await mkdir(targetDirectory, { recursive: true });
await copyHandlebarsTemplates(sourceDirectory);
