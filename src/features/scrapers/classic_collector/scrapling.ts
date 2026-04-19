import { execFile, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

export interface ClassicScraplingDetailContent {
  title: string;
  bodyText: string;
  images: string[];
}

type ScraplingProbeResult =
  | { ok: true; title: string; bodyText: string; images: string[] }
  | { ok: false; error: string };

type ScraplingBatchResult =
  | { ok: true; results: ScraplingProbeResultWithUrl[] }
  | { ok: false; error: string };

type ScraplingProbeResultWithUrl = ScraplingProbeResult & { url?: string };

const execFileAsync = promisify(execFile);

function isScraplingEnabled(): boolean {
  return !process.env.VERCEL;
}

export function canUseScraplingFallback(): boolean {
  return isScraplingEnabled();
}

export function shouldPreferScraplingFirst(): boolean {
  return isScraplingEnabled() && process.env.CLASSIC_FORCE_SCRAPLING === "1";
}

function resolveScraplingPython(): string {
  return process.env.SCRAPLING_PYTHON || "python3.11";
}

function shellEscape(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

export async function fetchClassicDetailWithScrapling(url: string): Promise<ClassicScraplingDetailContent | null> {
  if (!isScraplingEnabled()) return null;

  const scriptPath = path.resolve(process.cwd(), "scripts/classic_scrapling_fetch.py");
  let stdout = "";
  try {
    const shell = process.env.SHELL || "/bin/zsh";
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
    const parsed = JSON.parse(trimmed) as ScraplingProbeResult;
    if (!parsed.ok) return null;

    return {
      title: parsed.title ?? "",
      bodyText: parsed.bodyText ?? "",
      images: Array.isArray(parsed.images) ? parsed.images : [],
    };
  } catch {
    return null;
  }
}

export async function fetchClassicDetailBatchWithScrapling(
  urls: string[],
): Promise<Array<ClassicScraplingDetailContent | null> | null> {
  if (!isScraplingEnabled() || urls.length === 0) return [];

  const scriptPath = path.resolve(process.cwd(), "scripts/classic_scrapling_fetch.py");
  const result = spawnSync(resolveScraplingPython(), [scriptPath, ...urls], {
    encoding: "utf8",
    timeout: 120_000,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
    },
  });

  if (result.error || result.status !== 0) {
    return null;
  }

  const stdout = (result.stdout ?? "").trim();
  if (!stdout) return null;

  try {
    const parsed = JSON.parse(stdout) as ScraplingBatchResult;
    if (!parsed.ok || !Array.isArray(parsed.results)) return null;

    return parsed.results.map((item) => {
      if (!item.ok) return null;
      return {
        title: item.title ?? "",
        bodyText: item.bodyText ?? "",
        images: Array.isArray(item.images) ? item.images : [],
      };
    });
  } catch {
    return null;
  }
}

export async function fetchClassicPageHtmlWithScrapling(url: string): Promise<string | null> {
  if (!isScraplingEnabled()) return null;

  const tempDir = mkdtempSync(path.join(os.tmpdir(), "classic-scrapling-"));
  const htmlPath = path.join(tempDir, "page.html");
  const result = spawnSync("scrapling", ["extract", "stealthy-fetch", url, htmlPath, "--solve-cloudflare"], {
    encoding: "utf8",
    timeout: 180_000,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
    },
  });

  if (result.error || result.status !== 0) {
    return null;
  }

  try {
    return readFileSync(htmlPath, "utf8");
  } catch {
    return null;
  }
}
