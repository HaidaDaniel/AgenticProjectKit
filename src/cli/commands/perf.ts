import { resolve } from "node:path";

import {
  getPerfReport,
  getPerfStatus,
  renderPerfReport,
  runPerfExec,
  startPerfSession,
  stopPerfSession,
} from "../../core/perf/index.js";

const PERF_EXEC_CATEGORIES = ["repo-tool", "test", "lint", "build", "git"] as const;
type PerfExecCategory = (typeof PERF_EXEC_CATEGORIES)[number];

const PERF_HELP = [
  "Usage:",
  "  apk perf start --label <label>",
  "  apk perf status",
  "  apk perf stop",
  "  apk perf report [--json]",
  "  apk perf exec --category <repo-tool|test|lint|build|git> -- <command...>",
  "",
  "Profiling is opt-in and local. LLM generation and idle/unobserved gaps are excluded.",
].join("\n");

function helpRequested(args: readonly string[]): boolean {
  return args.includes("--help") || args.includes("-h");
}

function rootDirectory(): string {
  return resolve(process.cwd());
}

export async function runPerfCommand(args: string[]): Promise<number> {
  if (helpRequested(args)) {
    console.log(PERF_HELP);
    return 0;
  }
  const [subcommand, ...rest] = args;
  const root = rootDirectory();
  try {
    if (subcommand === "start") {
      if (rest.length !== 2 || rest[0] !== "--label") {
        console.error("Usage: apk perf start --label <label>");
        return 1;
      }
      const session = await startPerfSession(root, rest[1]!);
      console.log(`Performance session started: ${session.label}`);
      console.log("APK invocations are recorded automatically.");
      console.log("Use `apk perf exec -- ...` for non-APK repository commands you want included.");
      console.log("LLM generation and idle/unobserved gaps are not measured.");
      return 0;
    }
    if (subcommand === "status") {
      if (rest.length !== 0) {
        console.error("Usage: apk perf status");
        return 1;
      }
      const status = await getPerfStatus(root);
      console.log(status.active ? `Performance session active: ${status.label}` : "No active performance session.");
      return 0;
    }
    if (subcommand === "stop") {
      if (rest.length !== 0) {
        console.error("Usage: apk perf stop");
        return 1;
      }
      const session = await stopPerfSession(root);
      if (!session) {
        console.error("No active performance session.");
        return 1;
      }
      console.log(`Performance session stopped: ${session.label}`);
      return 0;
    }
    if (subcommand === "report") {
      if (rest.some((arg) => arg !== "--json")) {
        console.error("Usage: apk perf report [--json]");
        return 1;
      }
      const report = await getPerfReport(root);
      console.log(rest.includes("--json") ? JSON.stringify(report, null, 2) : renderPerfReport(report));
      return 0;
    }
    if (subcommand === "exec") {
      const categoryIndex = rest.indexOf("--category");
      const separator = rest.indexOf("--");
      if (categoryIndex !== 0 || separator !== 2 || !rest[1] || separator + 1 >= rest.length) {
        console.error("Usage: apk perf exec --category <repo-tool|test|lint|build|git> -- <command...>");
        return 1;
      }
      const category = rest[1];
      if (!PERF_EXEC_CATEGORIES.includes(category as PerfExecCategory)) {
        console.error("Invalid perf exec category; use repo-tool, test, lint, build, or git.");
        return 1;
      }
      const [command, ...commandArgs] = rest.slice(separator + 1);
      return await runPerfExec(root, category as PerfExecCategory, command!, commandArgs);
    }
    console.error(PERF_HELP);
    return 1;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
