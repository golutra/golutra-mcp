import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import process from "node:process";
import { URL } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function readEnv(name) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function requireEnv(name) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readPackageVersion() {
  const packageJsonPath = new URL("../package.json", import.meta.url);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

  if (
    !packageJson ||
    typeof packageJson !== "object" ||
    typeof packageJson.version !== "string" ||
    !packageJson.version.trim()
  ) {
    throw new Error("package.json is missing a valid version");
  }

  return packageJson.version;
}

function buildSetContextArgs() {
  const cliPath =
    readEnv("GOLUTRA_E2E_CLI_PATH") ?? readEnv("GOLUTRA_CLI_PATH");
  const workspacePath =
    readEnv("GOLUTRA_E2E_WORKSPACE_PATH") ?? readEnv("GOLUTRA_WORKSPACE_PATH");
  const profile =
    readEnv("GOLUTRA_E2E_PROFILE") ?? readEnv("GOLUTRA_PROFILE");

  return {
    cliPath: cliPath ?? requireEnv("GOLUTRA_E2E_CLI_PATH"),
    workspacePath:
      workspacePath ?? requireEnv("GOLUTRA_E2E_WORKSPACE_PATH"),
    ...(profile ? { profile } : {})
  };
}

function ensureToolSuccess(name, result) {
  if (result.isError) {
    throw new Error(
      `${name} failed: ${JSON.stringify(result.structuredContent ?? {}, null, 2)}`
    );
  }
  return result.structuredContent ?? {};
}

async function main() {
  const repoRoot = process.cwd();
  const packageVersion = readPackageVersion();
  const contextArgs = buildSetContextArgs();
  const userId = readEnv("GOLUTRA_E2E_USER_ID");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["dist/index.js"],
    cwd: repoRoot,
    stderr: "pipe"
  });
  let serverStderr = "";
  transport.stderr?.on("data", (chunk) => {
    serverStderr += chunk.toString();
  });

  const client = new Client(
    {
      name: "golutra-mcp-e2e-smoke",
      version: packageVersion
    },
    {
      capabilities: {}
    }
  );

  try {
    await client.connect(transport);

    const listedTools = await client.listTools();
    const toolNames = listedTools.tools.map((tool) => tool.name);
    assert(toolNames.includes("golutra-set-context"));
    assert(toolNames.includes("golutra-list-skills"));
    assert(toolNames.includes("golutra-diagnose"));

    const setContext = ensureToolSuccess(
      "golutra-set-context",
      await client.callTool({
        name: "golutra-set-context",
        arguments: contextArgs
      })
    );
    assert.equal(setContext.workspacePath, contextArgs.workspacePath);
    if (contextArgs.profile) {
      assert.equal(setContext.profile, contextArgs.profile);
    }

    const getContext = ensureToolSuccess(
      "golutra-get-context",
      await client.callTool({
        name: "golutra-get-context",
        arguments: {}
      })
    );
    assert.equal(getContext.workspacePath, contextArgs.workspacePath);

    const listSkills = ensureToolSuccess(
      "golutra-list-skills",
      await client.callTool({
        name: "golutra-list-skills",
        arguments: {}
      })
    );
    assert.equal(typeof listSkills.skills, "object");

    const listProjectSkills = ensureToolSuccess(
      "golutra-list-project-skills",
      await client.callTool({
        name: "golutra-list-project-skills",
        arguments: {}
      })
    );
    assert(Array.isArray(listProjectSkills.projectSkills));

    const diagnose = ensureToolSuccess(
      "golutra-diagnose",
      await client.callTool({
        name: "golutra-diagnose",
        arguments: {
          ...(userId ? { userId } : {})
        }
      })
    );
    assert.equal(diagnose.checks?.cliPath?.ok, true);
    assert.equal(diagnose.checks?.cliCommand?.ok, true);

    if (userId) {
      assert.equal(diagnose.checks?.workspace?.ok, true);
      assert.equal(diagnose.checks?.userId?.ok, true);
      assert.equal(diagnose.checks?.appConnection?.skipped, false);
      assert.equal(diagnose.checks?.appConnection?.ok, true);
    }

    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          context: getContext,
          builtInSkillNames: Object.keys(listSkills.skills ?? {}),
          projectSkillCount: Array.isArray(listProjectSkills.projectSkills)
            ? listProjectSkills.projectSkills.length
            : 0,
          diagnosisSummary: diagnose.summary,
          appProbeEnabled: Boolean(userId),
          appProbeOk:
            userId ? diagnose.checks?.appConnection?.ok === true : undefined
        },
        null,
        2
      )}\n`
    );
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    if (serverStderr.trim()) {
      process.stderr.write(`\n[golutra-mcp stderr]\n${serverStderr}\n`);
    }
    process.exitCode = 1;
  } finally {
    await transport.close();
  }
}

main();
