/**
 * Serverless-compatible browser launcher.
 *
 * - On Vercel: uses @sparticuz/chromium (small binary) + playwright-core (driver only)
 * - Locally / GitHub Actions: uses full playwright (bundled Chromium)
 */

import type { Browser, LaunchOptions } from "playwright-core";

const IS_VERCEL = !!process.env.VERCEL;

/**
 * Launch Chromium appropriate for the current environment.
 * Returns a playwright-core Browser instance in both cases.
 */
export async function launchServerlessBrowser(
  opts: LaunchOptions,
): Promise<Browser> {
  const { ...launchOpts } = opts;

  if (IS_VERCEL) {
    // Serverless path: @sparticuz/chromium + playwright-core
    const chromiumMod = await import("@sparticuz/chromium");
    const chromium = chromiumMod.default;
    const { chromium: pwChromium } = await import("playwright-core");

    // @sparticuz/chromium decompresses the brotli binary on first cold start
    const executablePath = await chromium.executablePath();

    return pwChromium.launch({
      ...launchOpts,
      executablePath,
      headless: true, // always headless on Vercel
      args: [
        ...(launchOpts.args ?? []),
        ...chromium.args,
      ],
    });
  }

  // Local / GitHub Actions path: full playwright with bundled Chromium
  const { chromium: pwChromium } = await import("playwright");
  return pwChromium.launch(launchOpts);
}
