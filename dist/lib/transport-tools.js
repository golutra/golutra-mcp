import { z } from "zod";
import { buildToolError, buildToolSuccess } from "./tool-results.js";
export function registerTransportTools(server, contextStore, gateway) {
    const contextSchema = {
        profile: z.enum(["dev", "canary", "stable"]).optional(),
        hostKind: z.enum(["desktop", "server"]).optional(),
        timeoutMs: z.number().int().positive().max(300_000).optional()
    };
    server.registerTool("golutra-cli-info", {
        title: "Read Golutra CLI and Host identity",
        description: "Read-only. Show actual CLI version/path, selected runtime profile and connected Host identity. Uses the CLI's discovery; never retries a command in another profile.",
        inputSchema: contextSchema
    }, async (input) => {
        try {
            return buildToolSuccess("Golutra CLI and Host identity.", await gateway.readCliInfo(contextStore.resolveCommandContext(input)));
        }
        catch (error) {
            return buildToolError(error);
        }
    });
    server.registerTool("golutra-wait-command", {
        title: "Wait for a previously submitted async command",
        description: "Read-only. Wait for a requestId returned by golutra-run-command with asynchronous=true. Use the same profile/Host as submission. Completed results remain readable for 15 minutes on current Hosts. Timeout only ends this wait; it does not cancel execution or resend the command. Host restart loses these in-memory handles.",
        inputSchema: { requestId: z.string().trim().min(1), ...contextSchema }
    }, async (input) => {
        try {
            return buildToolSuccess("Command completed.", await gateway.waitCommand(contextStore.resolveCommandContext(input), input.requestId));
        }
        catch (error) {
            return buildToolError(error);
        }
    });
}
//# sourceMappingURL=transport-tools.js.map