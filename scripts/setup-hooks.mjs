import { chmod, readdir } from "node:fs/promises";
import { join } from "node:path";

const hooksDirectory = ".husky/_";
const entries = await readdir(hooksDirectory, { withFileTypes: true });

for (const entry of entries) {
  if (!entry.isFile() || entry.name.startsWith(".")) continue;
  await chmod(join(hooksDirectory, entry.name), 0o755);
}
