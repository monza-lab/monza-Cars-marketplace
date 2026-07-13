import { spawn } from "node:child_process";

import type { CanaryResult } from "./database";
import type { AssuranceCanary, AssuranceSource } from "./manifest";

export type CanaryStatus = "healthy" | "failed" | "blocked" | "empty";

export interface CommandExecution {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

export interface CommandRequest {
  command: string;
  args: readonly string[];
  timeoutMs: number;
  env: NodeJS.ProcessEnv;
  shell: false;
}

export type CommandExecutor = (request: CommandRequest) => Promise<CommandExecution>;

export interface SourceCanaryResult extends CanaryResult {
  status: CanaryStatus;
  discovered: number | null;
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
}

const OUTPUT_LIMIT = 1_000_000;
const BLOCK_SIGNATURE = /captcha|cloudflare|\bwaf\b|access denied|robots(?:\.txt)? (?:denial|denied|blocked)|challenge[- ]page|verify (?:that )?you are human/i;

export function resolveCanaryInvocation(
  command: string,
  args: readonly string[],
  platform: NodeJS.Platform = process.platform,
  nodeExecutable = process.execPath,
): { command: string; args: string[] } {
  if (platform === "win32" && command.toLowerCase() === "npx") {
    const [tool, ...toolArgs] = args;
    const entrypoint = tool === "tsx"
      ? "node_modules/tsx/dist/cli.mjs"
      : tool === "vitest"
        ? "node_modules/vitest/vitest.mjs"
        : undefined;
    if (!entrypoint) throw new Error(`Unsupported shell-free npx tool on Windows: ${tool ?? "missing"}`);
    return { command: nodeExecutable, args: [entrypoint, ...toolArgs] };
  }
  return { command, args: [...args] };
}

function appendBounded(current: string, chunk: string): string {
  if (current.length >= OUTPUT_LIMIT) return current;
  const remaining = OUTPUT_LIMIT - current.length;
  const appended = current + chunk.slice(0, remaining);
  return chunk.length > remaining ? `${appended}\n[output truncated]` : appended;
}

export function redactCanaryOutput(
  output: string,
  env: Record<string, string | undefined> = process.env,
): string {
  let redacted = output;
  for (const [key, value] of Object.entries(env)) {
    if (value && /(?:^|_)https?_proxy$|(?:^|_)all_proxy$/i.test(key)) {
      redacted = redacted.split(value).join("[REDACTED_PROXY]");
    }
  }
  return redacted
    .replace(/([a-z][a-z0-9+.-]*:\/\/)([^\s/@]+(?::[^\s/@]*)?)@/gi, "$1[REDACTED]@")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(/((?:set-)?cookie\s*[:=]\s*)[^\r\n]+/gi, "$1[REDACTED]");
}

export const executeCanaryCommand: CommandExecutor = async (request) => new Promise((resolve) => {
  const startedAt = Date.now();
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  let settled = false;
  const invocation = resolveCanaryInvocation(request.command, request.args);
  const child = spawn(invocation.command, invocation.args, {
    env: request.env,
    shell: request.shell,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const finish = (exitCode: number | null) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    resolve({ exitCode, stdout, stderr, durationMs: Date.now() - startedAt, timedOut });
  };
  child.stdout?.on("data", (chunk) => {
    stdout = appendBounded(stdout, String(chunk));
  });
  child.stderr?.on("data", (chunk) => {
    stderr = appendBounded(stderr, String(chunk));
  });
  child.once("error", (error) => {
    stderr = appendBounded(stderr, error.message);
    finish(null);
  });
  child.once("close", (code) => finish(code));
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
  }, request.timeoutMs);
});

function discoveredCount(output: string): number | null {
  const match = /["']?discovered["']?\s*[:=]\s*(\d+)/i.exec(output);
  return match ? Number(match[1]) : null;
}

function blockSignaturePresent(output: string): boolean {
  const withoutZeroCounters = output.replace(
    /\b(?:cloudflare|cf|waf)[_\s-]*blocked["']?\s*[:=]\s*0\b/gi,
    "",
  );
  return BLOCK_SIGNATURE.test(withoutZeroCounters);
}

export async function runSourceCanary(
  source: AssuranceSource,
  canary: AssuranceCanary = source.canaries[0],
  execute: CommandExecutor = executeCanaryCommand,
): Promise<SourceCanaryResult> {
  if (!canary) throw new Error(`${source.id} has no canary command`);
  if (!canary.args.some((argument) => /dry.?run/i.test(argument))) {
    throw new Error(`${source.id}/${canary.jobId} canary command is missing dry-run protection`);
  }
  const execution = await execute({
    command: canary.command,
    args: canary.args,
    timeoutMs: canary.timeoutMs,
    env: { ...process.env, SCRAPER_ASSURANCE_CANARY: "1" },
    shell: false,
  });
  const stdout = redactCanaryOutput(execution.stdout);
  const stderr = redactCanaryOutput(execution.stderr);
  const output = `${stdout}\n${stderr}`;
  const discovered = discoveredCount(output);

  let status: CanaryStatus;
  if (blockSignaturePresent(output)) status = "blocked";
  else if (execution.timedOut || execution.exitCode !== 0 || discovered === null) status = "failed";
  else if (discovered === 0) status = "empty";
  else status = "healthy";

  return {
    id: `canary:${source.id}:${canary.jobId}`,
    source: source.id,
    ok: status === "healthy",
    status,
    discovered,
    exitCode: execution.exitCode,
    timedOut: execution.timedOut,
    durationMs: execution.durationMs,
    summary: `${source.id}/${canary.jobId} canary ${status}${discovered === null ? "" : ` (discovered=${discovered})`}`,
    stdout,
    stderr,
  };
}
