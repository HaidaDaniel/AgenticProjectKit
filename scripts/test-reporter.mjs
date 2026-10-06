import { inspect } from "node:util";

// Retain failures, stacks, diagnostics and totals without feeding hundreds of
// successful test names back into every agent's context.
export default async function* reporter(source) {
  for await (const event of source) {
    if (event.type === "test:fail") {
      yield `FAIL ${event.data.name}\n${inspect(event.data.details.error, { depth: 6, colors: false })}\n`;
    } else if (event.type === "test:stdout" || event.type === "test:stderr") {
      yield event.data.message;
    } else if (event.type === "test:diagnostic") {
      yield `${event.data.message}\n`;
    }
  }
}
