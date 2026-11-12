import { describe, expect, it } from "vitest";
import { NodeCliJsonRunner } from "../src/lib/cli-runner.js";
import { CliExecutionError } from "../src/lib/errors.js";
import { buildToolError } from "../src/lib/tool-results.js";

const runner = new NodeCliJsonRunner();
const command = (source: string, stdin?: string, timeoutMs = 5000) => ({
  cliPath: process.execPath, args: ["--input-type=module", "-e", source], timeoutMs, stdin
});

describe("CLI subprocess transport", () => {
  it("passes a large Unicode payload through stdin without shell expansion or argv truncation", async () => {
    const payload = JSON.stringify({ type: "audit.noop", payload: { text: "中文 --async --help `literal` $literal\n".repeat(10000) } });
    const result = await runner.executeJson<{ received: string }>(command(
      'let text=""; process.stdin.setEncoding("utf8"); for await (const part of process.stdin) text+=part; console.log(JSON.stringify({received:text}));', payload
    ));
    expect(result.received).toBe(payload);
  });

  it("preserves structured failure codes and request IDs even when a CLI exits zero", async () => {
    const request = command('console.log(JSON.stringify({ok:false,errorCode:"COMMAND_IPC_RESULT_UNCONFIRMED",error:"unknown execution outcome",requestId:"same-id"}));');
    await expect(runner.executeJson(request)).rejects.toMatchObject({ code: "COMMAND_IPC_RESULT_UNCONFIRMED", requestId: "same-id" });
  });

  it("uses the business error message when the transport envelope has no error", async () => {
    await expect(runner.executeJson(command('console.log(JSON.stringify({ok:false,error:null,result:{status:"error",message:"scope denied"}})); process.exitCode=1;'))).rejects.toThrow("scope denied");
  });

  it("preserves structured per-item successes and retryFile when partial failure exits one", async () => {
    const response = {ok:true,retryFile:"/retry.json",result:{status:"ok",data:{accepted:1,failed:1,items:[{key:"a",status:"queued"},{key:"b",status:"failed",error:"missing member"}]}}};
    try {
      await runner.executeJson(command(`console.log(${JSON.stringify(JSON.stringify(response))}); process.exitCode=1;`));
      expect.unreachable("partial failure must be reported");
    } catch (error) {
      expect(buildToolError(error)).toMatchObject({isError:true,structuredContent:{retryFile:"/retry.json",response}});
    }
  });

  it("retains the saved request after timeout before a final JSON response", async () => {
    const retryFile = "/a b/中文'\nrequest.json";
    const diagnostic = JSON.stringify({type:"chat.retry",retryFile});
    try {
      await runner.executeJson(command(`console.error(${JSON.stringify(diagnostic)}); setInterval(()=>{},1000);`,undefined,250));
      expect.unreachable("child must time out");
    } catch (error) {
      expect(buildToolError(error)).toMatchObject({isError:true,structuredContent:{errorCode:"CLI_PROCESS_TIMEOUT",retryFile}});
    }
  });

  it("reports spawn failure without hanging or throwing an unhandled stdin error", async () => {
    await expect(runner.executeJson({ cliPath: "/missing/golutra-cli-audit", args: [], timeoutMs: 1000, stdin: "{}" })).rejects.toMatchObject({ code: "CLI_START_FAILED" });
  });

  it("reaps a timed-out CLI even when it ignores SIGTERM", async () => {
    let failure: unknown;
    try {
      await runner.executeJson(command('process.on("SIGTERM",()=>{}); console.log(JSON.stringify({pid:process.pid})); setInterval(()=>{},1000);', undefined, 250));
    } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(CliExecutionError);
    const error = failure as CliExecutionError;
    expect(error.code).toBe("CLI_PROCESS_TIMEOUT");
    const pid = (JSON.parse(error.stdout) as { pid: number }).pid;
    expect(() => process.kill(pid, 0)).toThrow();
  });
});
