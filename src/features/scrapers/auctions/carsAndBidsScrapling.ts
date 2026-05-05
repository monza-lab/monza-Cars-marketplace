import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function isCaBScraplingEnabled(): boolean {
  return !process.env.VERCEL;
}

export function canUseCaBScraplingFallback(): boolean {
  return isCaBScraplingEnabled();
}

export async function fetchCaBHtmlWithScrapling(url: string): Promise<string | null> {
  if (!isCaBScraplingEnabled()) return null;

  const tempDir = mkdtempSync(path.join(os.tmpdir(), "cab-scrapling-"));
  const htmlPath = path.join(tempDir, "page.html");
  try {
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

    return readFileSync(htmlPath, "utf8");
  } catch {
    return null;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
