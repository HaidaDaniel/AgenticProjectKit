export class ConfigValidationError extends Error {
    issues;
    constructor(issues) {
        super(`Invalid Agentic Project Kit config:\n- ${issues.join("\n- ")}`);
        this.name = "ConfigValidationError";
        this.issues = issues;
    }
}
