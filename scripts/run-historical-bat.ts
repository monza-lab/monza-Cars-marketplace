import { runHistoricalBat } from "../src/features/porsche_collector/historical_bat/run";

type Scope = "all" | "vehicle" | "sold_vehicle";

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.slice(2).find((entry) => entry.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dryRun");
  const scope = (arg("scope", "all") ?? "all") as Scope;
  const result = await runHistoricalBat({
    dryRun,
    timeFrame: arg("timeFrame", "1Y") ?? "1Y",
    scope,
    maxPages: Number(arg("maxPages", "1")),
    startPage: Number(arg("startPage", "0")),
    checkpointPath: arg("checkpointPath", "var/porsche_collector/historical_bat/checkpoint.json") ?? "var/porsche_collector/historical_bat/checkpoint.json",
    allowCheckpointMismatch: process.argv.includes("--allowCheckpointMismatch"),
  });

  console.log(JSON.stringify({
    manifestPath: result.manifestPath,
    rejectsPath: result.rejectsPath,
    manifest: result.manifest,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
