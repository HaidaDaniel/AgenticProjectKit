import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = dirname(dirname(fileURLToPath(import.meta.url)));

await rm(join(rootDirectory, "dist"), {
  force: true,
  recursive: true,
});
