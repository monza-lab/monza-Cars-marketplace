import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

type Scope = "all" | "vehicle" | "sold_vehicle";

type Manifest = {
  run_id: string;
  started_at: string;
  finished_at: string;
  time_frame: string;
  scope: Scope;
  expected_items_total: number;
  expected_pages_total: number;
  pages_scanned: number;
  fetched: number;
  kept: number;
  inserted: number;
  updated: number;
  rejected: number;
  errors: number;
  duplicates: number;
  reconciliation: {
    observed_unique_ids: number;
    expected_items_total: number;
    expected_pages_total: number;
    progress_ratio: number;
    pages_progress_ratio: number;
    complete: boolean;
  };
};

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.slice(2).find((entry) => entry.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function loadJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function latestManifest(scope: Scope, timeFrame: string): string {
  const root = path.resolve(process.cwd(), "var/runs/porsche_collector/historical_bat");
  if (!existsSync(root)) throw new Error(`Missing run directory: ${root}`);
  const files = readdirSync(root)
    .filter((f) => f.endsWith(".json") && f.includes(`_${scope}`))
    .map((f) => path.join(root, f))
    .sort((a, b) => b.localeCompare(a));

  for (const file of files) {
    const m = loadJson<Manifest>(file);
    if (m.time_frame === timeFrame && m.scope === scope) return file;
  }
  throw new Error(`No manifest found for scope=${scope} timeFrame=${timeFrame}`);
}

async function main(): Promise<void> {
  const scope = (arg("scope", "all") ?? "all") as Scope;
  const timeFrame = arg("timeFrame", "1Y") ?? "1Y";
  const checkpointPath = path.resolve(process.cwd(), arg("checkpointPath", "var/porsche_collector/historical_bat/checkpoint.json") ?? "var/porsche_collector/historical_bat/checkpoint.json");
  const manifestPath = arg("manifestPath") ? path.resolve(process.cwd(), arg("manifestPath") as string) : latestManifest(scope, timeFrame);

  const manifest = loadJson<Manifest>(manifestPath);
  const checkpoint = existsSync(checkpointPath)
    ? loadJson<Record<string, unknown>>(checkpointPath)
    : null;

  console.log(JSON.stringify({
    manifestPath,
    checkpointPath,
    scope,
    timeFrame,
    manifest: {
      run_id: manifest.run_id,
      pages_scanned: manifest.pages_scanned,
      fetched: manifest.fetched,
      kept: manifest.kept,
      inserted: manifest.inserted,
      updated: manifest.updated,
      rejected: manifest.rejected,
      errors: manifest.errors,
      duplicates: manifest.duplicates,
    },
    reconciliation: {
      observed_unique_ids: manifest.reconciliation.observed_unique_ids,
      expected_items_total: manifest.reconciliation.expected_items_total,
      expected_pages_total: manifest.reconciliation.expected_pages_total,
      progress_ratio: manifest.reconciliation.progress_ratio,
      pages_progress_ratio: manifest.reconciliation.pages_progress_ratio,
      complete: manifest.reconciliation.complete,
    },
    checkpoint,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
