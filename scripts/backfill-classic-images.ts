/**
 * CLI script for bulk ClassicCom detail backfill using Playwright/Scrapling.
 *
 * Usage:
  *   npx tsx scripts/backfill-classic-images.ts
  *   npx tsx scripts/backfill-classic-images.ts --maxListings=50 --headed
  *   npx tsx scripts/backfill-classic-images.ts --navigationDelayMs=5000
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load .env.local if it exists (not available in CI — env vars come from secrets)
const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    maxListings: undefined as number | undefined,
    batchSize: 100,
    navigationDelayMs: 3000,
    pageTimeoutMs: 20000,
    headed: false,
    timeBudgetMs: 30 * 60 * 1000, // 30 minutes default
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx > 0) {
        const key = arg.slice(2, eqIdx);
        const val = arg.slice(eqIdx + 1);
        switch (key) {
          case "maxListings":
            opts.maxListings = parseInt(val, 10);
            break;
          case "batchSize":
            opts.batchSize = parseInt(val, 10);
            break;
          case "navigationDelayMs":
            opts.navigationDelayMs = parseInt(val, 10);
            break;
          case "pageTimeoutMs":
            opts.pageTimeoutMs = parseInt(val, 10);
            break;
          case "timeBudgetMs":
            opts.timeBudgetMs = parseInt(val, 10);
            break;
        }
      } else {
        const key = arg.slice(2);
        if (key === "headed") opts.headed = true;
        if (key === "help") {
          console.log(`
Usage: npx tsx scripts/backfill-classic-images.ts [options]

Options:
  --maxListings=<n>          Total listings to process (omit for full sweep)
  --batchSize=<n>            Batch size per query (default: 100)
  --navigationDelayMs=<ms>   Delay between page navigations (default: 3000)
  --pageTimeoutMs=<ms>       Page load timeout (default: 20000)
  --timeBudgetMs=<ms>        Total time budget (default: 1800000 = 30 min)
  --headed                   Show browser window (default: headless)
  --help                     Show this help
          `);
          process.exit(0);
        }
      }
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  process.env.CLASSIC_DISABLE_PLAYWRIGHT_FALLBACK ??= "1";
  const useScraplingOnly = process.env.CLASSIC_DISABLE_PLAYWRIGHT_FALLBACK === "1";

  console.log(`\n=== ClassicCom Detail Backfill ===`);
  console.log(`Max listings: ${opts.maxListings ?? "all"}`);
  console.log(`Batch size: ${opts.batchSize}`);
  console.log(`Navigation delay: ${opts.navigationDelayMs}ms`);
  console.log(`Time budget: ${Math.round(opts.timeBudgetMs / 1000)}s`);
  console.log(`Scrapling-only fallback: ${useScraplingOnly}`);
  console.log(`Headed: ${opts.headed}\n`);

  // Dynamic imports to avoid loading Playwright at parse time
  const { backfillMissingImages } =
    await import("../src/features/scrapers/classic_collector/backfill");

  const runId = crypto.randomUUID();
  let browser;
  let page: any = undefined;

  try {
    if (!useScraplingOnly) {
      const { launchStealthBrowser, createStealthContext, createPage, closeBrowser } =
        await import("../src/features/scrapers/classic_collector/browser");

      console.log("Launching stealth browser...");
      browser = await launchStealthBrowser({
        headless: !opts.headed,
        proxyServer: process.env.DECODO_PROXY_URL,
        proxyUsername: process.env.DECODO_PROXY_USER,
        proxyPassword: process.env.DECODO_PROXY_PASS,
      });

      const context = await createStealthContext(browser, {
        headless: !opts.headed,
        proxyServer: process.env.DECODO_PROXY_URL,
        proxyUsername: process.env.DECODO_PROXY_USER,
        proxyPassword: process.env.DECODO_PROXY_PASS,
      });

      page = await createPage(context, true); // blockMedia=true for speed
      console.log("Browser ready.\n");
    } else {
      console.log("Skipping browser launch in scrapling-only mode.\n");
    }

    const result = await backfillMissingImages({
      page,
      timeBudgetMs: opts.timeBudgetMs,
      maxListings: opts.maxListings,
      batchSize: opts.batchSize,
      navigationDelayMs: opts.navigationDelayMs,
      pageTimeoutMs: opts.pageTimeoutMs,
      runId,
    });

    console.log(`\n=== RESULTS ===`);
    console.log(`Discovered: ${result.discovered}`);
    console.log(`Backfilled: ${result.backfilled}`);
    console.log(`Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log(`\nError details:`);
      for (const err of result.errors.slice(0, 20)) {
        console.log(`  - ${err}`);
      }
      if (result.errors.length > 20) {
        console.log(`  ... and ${result.errors.length - 20} more`);
      }
    }

    console.log(`\nDone!`);
  } finally {
    if (browser) {
      console.log("Closing browser...");
      const { closeBrowser } = await import("../src/features/scrapers/classic_collector/browser");
      await closeBrowser(browser);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
