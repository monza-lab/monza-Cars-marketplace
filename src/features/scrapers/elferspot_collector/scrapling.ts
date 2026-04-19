import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

type ScraplingResult =
  | { ok: true; html: string }
  | { ok: false; error: string };

function isScraplingEnabled(): boolean {
  return !process.env.VERCEL;
}

export function canUseScraplingFallback(): boolean {
  return isScraplingEnabled();
}

function resolveScraplingPython(): string {
  return process.env.SCRAPLING_PYTHON || "python3.11";
}

function shellEscape(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

/**
 * Fetch a single Elferspot page via Scrapling and return the raw HTML.
 * Returns null on any failure (graceful fallback).
 */
export async function fetchHtmlWithScrapling(url: string): Promise<string | null> {
  if (!isScraplingEnabled()) return null;

  const scriptPath = path.resolve(process.cwd(), "scripts/elferspot_scrapling_fetch.py");
  let stdout = "";
  try {
    const shell = process.env.SHELL || (process.platform === "win32" ? "bash" : "/bin/zsh");
    const command = `${resolveScraplingPython()} ${shellEscape(scriptPath)} ${shellEscape(url)}`;
    const result = await execFileAsync(shell, ["-lc", command], {
      encoding: "utf8",
      timeout: 120_000,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
    });
    stdout = typeof result === "string" ? result : result.stdout ?? "";
  } catch {
    return null;
  }

  const trimmed = stdout.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as ScraplingResult;
    if (!parsed.ok) return null;
    return parsed.html;
  } catch {
    return null;
  }
}
