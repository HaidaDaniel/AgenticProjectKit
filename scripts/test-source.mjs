import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceFiles = process.argv.slice(2);
if (!sourceFiles.length || sourceFiles.some((file) => !file.startsWith("src/") || !file.endsWith(".test.ts") || file.includes(".."))) {
  throw new Error("Specify repository src/**/*.test.ts files");
}

async function run(args) {
  const child = spawn(process.execPath, args, { cwd: root, stdio: "inherit" });
  return new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolveExit(code ?? (signal ? 1 : 0)));
  });
}

const cache = join(root, "node_modules/.cache");
await mkdir(cache, { recursive: true });
const workspace = await mkdtemp(join(cache, "apk-source-tests-"));
try {
  await writeFile(join(workspace, "package.json"), await readFile(join(root, "package.json")));
  const output = join(workspace, "dist");
  const compilation = await run([
    join(root, "node_modules/typescript/bin/tsc"), "-p", join(root, "tsconfig.json"),
    "--outDir", output, "--sourceMap", "--inlineSources",
  ]);
  if (compilation !== 0) {
    process.exitCode = compilation;
  } else {
    await cp(join(root, "src/core/templates"), join(output, "core/templates"), {
      recursive: true,
      filter: async (path) => (await stat(path)).isDirectory() || path.endsWith(".hbs"),
    });
    const testFiles = sourceFiles.map((file) => join(output, relative("src", file).replace(/\.ts$/, ".js")));
    process.exitCode = await run([
      "--enable-source-maps", "--test", "--test-reporter=./scripts/test-reporter.mjs", ...testFiles,
    ]);
  }
} finally {
  await rm(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
}
