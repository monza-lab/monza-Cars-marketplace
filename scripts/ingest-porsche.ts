import { runIngest } from "../src/features/porsche_ingest/entrypoints/run_ingest";

async function main(): Promise<void> {
  const report = await runIngest(process.argv.slice(2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
