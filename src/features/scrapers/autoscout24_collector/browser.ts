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
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

const EU_LOCALES = [
  { locale: "de-DE", timezone: "Europe/Berlin", lang: "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7" },
  { locale: "fr-FR", timezone: "Europe/Paris", lang: "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7" },
  { locale: "it-IT", timezone: "Europe/Rome", lang: "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7" },
  { locale: "nl-NL", timezone: "Europe/Amsterdam", lang: "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7" },
  { locale: "es-ES", timezone: "Europe/Madrid", lang: "es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7" },
  { locale: "en-GB", timezone: "Europe/London", lang: "en-GB,en;q=0.9,de;q=0.8" },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const STEALTH_INIT_SCRIPT = `
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'plugins', {
    get: () => [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
      { name: 'Native Client', filename: 'internal-nacl-plugin' },
    ],
  });
  if (!window.chrome) window.chrome = {};
  if (!window.chrome.runtime) {
    window.chrome.runtime = { connect: () => {}, sendMessage: () => {} };
  }
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
 */
export async function launchStealthBrowser(config: BrowserConfig): Promise<Browser> {
  return launchServerlessBrowser({
    headless: config.headless,
    args: STEALTH_ARGS,
    proxyServer: config.proxyServer,
    proxyUsername: config.proxyUsername,
    proxyPassword: config.proxyPassword,
  });
}

/**
 * Create a browser context with stealth fingerprint overrides.
 * Uses EU-specific locales and timezones for AutoScout24.
 */
export async function createStealthContext(browser: Browser, config: BrowserConfig): Promise<BrowserContext> {
  const width = 1920 + Math.floor(Math.random() * 100) - 50;
  const height = 1080 + Math.floor(Math.random() * 60) - 30;
  const euLocale = pickRandom(EU_LOCALES);

  const context = await browser.newContext({
    userAgent: pickRandom(USER_AGENTS),
    viewport: { width, height },
    locale: euLocale.locale,
    timezoneId: euLocale.timezone,
    colorScheme: "light",
    javaScriptEnabled: true,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      "Accept-Language": euLocale.lang,
    },
  });

  await context.addInitScript(STEALTH_INIT_SCRIPT);
  return context;
}

/**
 * Create a new page from the stealth context.
 * Blocks heavy resources (fonts, media) to speed up navigation.
 */
export async function createPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.route("**/*.{woff,woff2,ttf,otf,eot}", (route) => route.abort());
  await page.route("**/*.{mp4,webm,ogg,wav,mp3}", (route) => route.abort());
  return page;
}

/**
 * Detect if the current page is showing an Akamai or generic bot challenge.
 */
export async function isAkamaiChallenge(page: Page): Promise<boolean> {
  const title = await page.title();
  if (title.includes("Just a moment") || title.includes("Access Denied")) return true;

  const hasChallenge = await page.evaluate(() => {
    const body = document.body?.innerText ?? "";
    return (
      document.querySelector("#challenge-running") !== null ||
      document.querySelector("#challenge-form") !== null ||
      document.querySelector(".cf-browser-verification") !== null ||
      /access denied|blocked|captcha|bot detection/i.test(body.slice(0, 500))
    );
  }).catch(() => false);

  return hasChallenge;
}

/**
 * Wait for a JS challenge to auto-resolve.
 * Returns true if challenge was solved, false if it timed out.
 */
export async function waitForChallengeResolution(page: Page, timeoutMs = 15_000): Promise<boolean> {
  const isChallenge = await isAkamaiChallenge(page);
  if (!isChallenge) return true;

  try {
    await page.waitForFunction(
      () => {
        const title = document.title;
        return (
          !title.includes("Just a moment") &&
          !title.includes("Access Denied") &&
          document.querySelector("#challenge-running") === null
        );
      },
      { timeout: timeoutMs },
    );
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Dismiss AutoScout24 cookie consent banner if present.
 */
export async function dismissCookieConsent(page: Page): Promise<void> {
  const selectors = [
    'button[data-testid="gdpr-banner-accept"]',
    '#onetrust-accept-btn-handler',
    'button[id*="accept"]',
    'button[class*="consent-accept"]',
    'button:has-text("Accept")',
    'button:has-text("Akzeptieren")',
    'button:has-text("Accepter")',
    'button:has-text("Accetta")',
  ];

  for (const selector of selectors) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        await page.waitForTimeout(500);
        return;
      }
    } catch {
      // Try next selector
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
