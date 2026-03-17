import { CliExecutionError } from "./errors.js";

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function buildToolSuccess<T extends object>(
  summary: string,
  structuredContent: T
): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: Record<string, unknown>;
} {
  const normalizedStructuredContent = {
    ...structuredContent
  } as Record<string, unknown>;

  return {
    content: [
      {
        type: "text",
        text: `${summary}\n\n${toPrettyJson(normalizedStructuredContent)}`
      }
    ],
    structuredContent: normalizedStructuredContent
  };
}

export function buildToolError(error: unknown): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: Record<string, unknown>;
  isError: true;
} {
  const structuredContent = buildErrorContent(error);
  const message =
    typeof structuredContent.message === "string"
      ? structuredContent.message
      : String(error);

  return {
    content: [
      {
        type: "text",
        text: `Error: ${message}\n\n${toPrettyJson(structuredContent)}`
      }
    ],
    structuredContent,
    isError: true
  };
}

function buildErrorContent(error: unknown): Record<string, unknown> {
  if (error instanceof CliExecutionError) {
    return {
      type: error.name,
      message: error.message,
      cliPath: error.cliPath,
      args: error.args,
      exitCode: error.exitCode,
      stdout: error.stdout,
      stderr: error.stderr
    };
  }
  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message
    };
  }
  return {
    type: "UnknownError",
    message: String(error)
  };
}
