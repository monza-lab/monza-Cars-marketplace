import type { Browser, BrowserContext, Page } from "playwright-core";
import { launchServerlessBrowser } from "@/features/scrapers/common/serverless-browser";

export interface BrowserConfig {
  headless: boolean;
  proxyServer?: string;
  proxyUsername?: string;
  proxyPassword?: string;
}

const STEALTH_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--disable-infobars",
  "--window-size=1920,1080",
  "--disable-background-networking",
  "--disable-default-apps",
  "--disable-extensions",
  "--disable-sync",
  "--disable-translate",
  "--metrics-recording-only",
  "--no-first-run",
];

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
];

function pickUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Init script injected into every page to remove automation fingerprints.
 */
const STEALTH_INIT_SCRIPT = `
  // Remove webdriver flag
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

  // Override navigator.plugins to look like a real browser
  Object.defineProperty(navigator, 'plugins', {
    get: () => [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
      { name: 'Native Client', filename: 'internal-nacl-plugin' },
    ],
  });

  // Override navigator.languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
  });

  // Fake chrome.runtime to look like a real Chrome extension environment
  if (!window.chrome) window.chrome = {};
  if (!window.chrome.runtime) {
    window.chrome.runtime = {
      connect: () => {},
      sendMessage: () => {},
    };
  }

  // Override permissions query
  const originalQuery = window.navigator.permissions?.query;
  if (originalQuery) {
    window.navigator.permissions.query = (parameters) => {
      if (parameters.name === 'notifications') {
        return Promise.resolve({ state: Notification.permission });
      }
      return originalQuery(parameters);
    };
  }
`;

/**
 * Launch a Chromium browser with stealth anti-detection settings.
 * On Vercel: uses serverless-browser (sparticuz/chromium).
 * Local / GitHub Actions: uses rebrowser-playwright for Cloudflare bypass.
 */
export async function launchStealthBrowser(config: BrowserConfig): Promise<Browser> {
  if (process.env.VERCEL) {
    return launchServerlessBrowser({
      headless: config.headless,
      args: STEALTH_ARGS,
      proxyServer: config.proxyServer,
      proxyUsername: config.proxyUsername,
      proxyPassword: config.proxyPassword,
    });
  }

  // Local / GitHub Actions: prefer rebrowser-playwright for Cloudflare CDP bypass,
  // fall back to regular playwright if the rebrowser binary is missing.
  const launchOptions: Record<string, unknown> = {
    headless: config.headless,
    args: STEALTH_ARGS,
  };

  if (config.proxyServer) {
    launchOptions.proxy = {
      server: config.proxyServer,
      username: config.proxyUsername,
      password: config.proxyPassword,
    };
  }

  try {
    const { chromium } = await import("rebrowser-playwright");
    const browser = await chromium.launch(launchOptions);
    return browser as unknown as Browser;
  } catch (err) {
    console.warn(
      `[classic_collector] rebrowser-playwright launch failed, falling back to playwright: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    const { chromium } = await import("playwright");
    const browser = await chromium.launch(launchOptions);
    return browser as unknown as Browser;
  }
}

/**
 * Create a browser context with stealth fingerprint overrides.
 */
export async function createStealthContext(
  browser: Browser,
  config: BrowserConfig,
): Promise<BrowserContext> {
  const width = 1920 + Math.floor(Math.random() * 100) - 50;
  const height = 1080 + Math.floor(Math.random() * 60) - 30;

  const context = await browser.newContext({
    userAgent: pickUserAgent(),
    viewport: { width, height },
    locale: "en-US",
    timezoneId: "America/New_York",
    colorScheme: "light",
    javaScriptEnabled: true,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  await context.addInitScript(STEALTH_INIT_SCRIPT);
  return context;
}

/**
 * Create a new page from the stealth context.
 * Optionally blocks heavy resources (fonts, media) to speed up navigation.
 */
export async function createPage(
  context: BrowserContext,
  blockMedia = false,
): Promise<Page> {
  const page = await context.newPage();

  if (blockMedia) {
    await page.route("**/*.{woff,woff2,ttf,otf,eot}", (route) => route.abort());
    await page.route("**/*.{mp4,webm,ogg,wav,mp3}", (route) => route.abort());
  }

  return page;
}

/**
 * Detect if the current page is showing a Cloudflare challenge.
 */
export async function isCloudflareChallenge(page: Page): Promise<boolean> {
  const title = await page.title();
  if (title.includes("Just a moment")) return true;

  const hasChallenge = await page.evaluate(() => {
    return document.querySelector("#challenge-running") !== null ||
           document.querySelector("#challenge-form") !== null ||
           document.querySelector(".cf-browser-verification") !== null ||
           document.querySelector("#turnstile-wrapper") !== null ||
           document.querySelector("[data-ray]") !== null;
  }).catch(() => false);

  return hasChallenge;
}

/**
 * Attempt to click the Cloudflare Turnstile checkbox if present.
 * Turnstile is rendered in an iframe — we need to find and click inside it.
 */
async function clickTurnstileCheckbox(page: Page): Promise<void> {
  try {
    // Turnstile lives inside an iframe with src containing challenges.cloudflare.com
    const frames = page.frames();
    for (const frame of frames) {
      const url = frame.url();
      if (url.includes("challenges.cloudflare.com") || url.includes("turnstile")) {
        // Try to click the checkbox inside the challenge iframe
        const checkbox = await frame.$("input[type='checkbox']");
        if (checkbox) {
          await checkbox.click();
          return;
        }
        // Some Turnstile variants use a div/label as the clickable area
        const clickTarget = await frame.$(".cb-lb") ?? await frame.$("[id^='cf-']");
        if (clickTarget) {
          await clickTarget.click();
          return;
        }
        // Last resort: click the body of the iframe (some challenges auto-solve on interaction)
        const body = await frame.$("body");
        if (body) {
          await body.click();
          return;
        }
      }
    }

    // Fallback: try clicking any visible challenge elements on the main page
    const challengeBtn = await page.$("#challenge-stage input[type='button']")
      ?? await page.$(".cf-turnstile")
      ?? await page.$("[data-sitekey]");
    if (challengeBtn) {
      await challengeBtn.click();
    }
  } catch {
    // Clicking failed — the challenge may auto-resolve or we'll time out
  }
}

/**
 * Wait for a Cloudflare challenge to resolve.
 * Attempts to click Turnstile checkbox and waits for redirect.
 * Returns true if challenge was solved, false if it timed out.
 */
export async function waitForCloudflareResolution(
  page: Page,
  timeoutMs = 30_000,
): Promise<boolean> {
  const isChallenge = await isCloudflareChallenge(page);
  if (!isChallenge) return true;

  // Wait a moment for Turnstile iframe to load, then attempt click
  await page.waitForTimeout(2_000);
  await clickTurnstileCheckbox(page);

  try {
    await page.waitForFunction(
      () => {
        const title = document.title;
        return !title.includes("Just a moment") &&
               document.querySelector("#challenge-running") === null &&
               document.querySelector("#turnstile-wrapper") === null;
      },
      { timeout: timeoutMs },
    );
    // Give a moment for the redirect to complete
    await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {});
    return true;
  } catch {
    // First attempt failed — try clicking again (iframe may have reloaded)
    await clickTurnstileCheckbox(page);
    try {
      await page.waitForFunction(
        () => !document.title.includes("Just a moment"),
        { timeout: 10_000 },
      );
      await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Safely close a browser instance.
 */
export async function closeBrowser(browser: Browser): Promise<void> {
  try {
    await browser.close();
  } catch {
    // Ignore errors during cleanup
  }
}
