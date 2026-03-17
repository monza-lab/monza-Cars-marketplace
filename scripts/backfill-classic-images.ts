/**
 * CLI script for bulk ClassicCom image backfill using Playwright.
 *
 * Usage:
 *   npx tsx scripts/backfill-classic-images.ts
 *   npx tsx scripts/backfill-classic-images.ts --maxListings=50 --headed
 *   npx tsx scripts/backfill-classic-images.ts --navigationDelayMs=5000
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
const envPath = resolve(__dirname, "../.env.local");
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

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    maxListings: 50,
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
  --maxListings=<n>          Max listings to process (default: 50)
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

  console.log(`\n=== ClassicCom Image Backfill ===`);
  console.log(`Max listings: ${opts.maxListings}`);
  console.log(`Navigation delay: ${opts.navigationDelayMs}ms`);
  console.log(`Time budget: ${Math.round(opts.timeBudgetMs / 1000)}s`);
  console.log(`Headed: ${opts.headed}\n`);

  // Dynamic imports to avoid loading Playwright at parse time
  const { launchStealthBrowser, createStealthContext, createPage, closeBrowser } =
    await import("../src/features/scrapers/classic_collector/browser");
  const { backfillMissingImages } =
    await import("../src/features/scrapers/classic_collector/backfill");

  const runId = crypto.randomUUID();
  let browser;

  try {
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

    const page = await createPage(context, true); // blockMedia=true for speed
    console.log("Browser ready.\n");

    const result = await backfillMissingImages({
      page,
      timeBudgetMs: opts.timeBudgetMs,
      maxListings: opts.maxListings,
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
      await closeBrowser(browser);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
