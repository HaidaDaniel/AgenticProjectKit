export class ConfigValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid Agentic Project Kit config:\n- ${issues.join("\n- ")}`);
    this.name = "ConfigValidationError";
    this.issues = issues;
  }
}

