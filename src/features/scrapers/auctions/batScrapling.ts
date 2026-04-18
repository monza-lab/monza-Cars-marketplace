import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function isBaTScraplingEnabled(): boolean {
  return !process.env.VERCEL;
}

export function canUseBaTScraplingFallback(): boolean {
  return isBaTScraplingEnabled();
}

export async function fetchBaTDetailHtmlWithScrapling(url: string): Promise<string | null> {
  if (!isBaTScraplingEnabled()) return null;

  const tempDir = mkdtempSync(path.join(os.tmpdir(), "bat-scrapling-"));
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
