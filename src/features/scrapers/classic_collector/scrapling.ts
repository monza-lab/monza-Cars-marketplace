import { spawnSync } from "node:child_process";
import path from "node:path";

export interface ClassicScraplingDetailContent {
  title: string;
  bodyText: string;
  images: string[];
}

type ScraplingProbeResult =
  | { ok: true; title: string; bodyText: string; images: string[] }
  | { ok: false; error: string };

function isScraplingEnabled(): boolean {
  return !process.env.VERCEL;
}

export function canUseScraplingFallback(): boolean {
  return isScraplingEnabled();
}

export async function fetchClassicDetailWithScrapling(url: string): Promise<ClassicScraplingDetailContent | null> {
  if (!isScraplingEnabled()) return null;

  const scriptPath = path.resolve(process.cwd(), "scripts/classic_scrapling_fetch.py");
  const result = spawnSync("python3", [scriptPath, url], {
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
    const parsed = JSON.parse(stdout) as ScraplingProbeResult;
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
