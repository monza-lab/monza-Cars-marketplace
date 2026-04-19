#!/usr/bin/env tsx
/**
 * CLI entry for the MonzaHaus Social Engine worker.
 * Mirrors the pattern of ingest-porsche.ts.
 *
 * Usage:
 *   npx tsx scripts/social-engine-worker.ts
 */

import { runWorker } from "../src/features/social-engine/workers/worker";

async function main() {
  try {
    const result = await runWorker();
    console.log("\n=== Worker Result ===");
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("Worker failed:", err);
    process.exit(1);
  }
}

main();
