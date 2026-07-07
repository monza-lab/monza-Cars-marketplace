// Frontend smoke/functional check via Playwright.
// Usage: node scripts/frontend-check.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.join(__dirname, '..', '.frontend-check');
mkdirSync(SHOT_DIR, { recursive: true });

const routes = [
  { name: 'home-dashboard', url: '/' },
  { name: 'cars-porsche', url: '/cars/porsche' },
  { name: 'cars-porsche-992', url: '/cars/porsche?family=992' },
  { name: 'auctions', url: '/auctions' },
  { name: 'browse', url: '/browse' },
  { name: 'search', url: '/search' },
  { name: 'buy-porsche', url: '/buy/porsche' },
  { name: 'pricing', url: '/pricing' },
  { name: 'methodology', url: '/methodology' },
  { name: 'indices', url: '/indices' },
  { name: 'knowledge', url: '/knowledge' },
  { name: 'advisor', url: '/advisor' },
  { name: 'vin-decoder', url: '/tools/porsche-vin-decoder' },
];

const report = [];

function attachListeners(page, bucket) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') bucket.consoleErrors.push(msg.text());
    if (msg.type() === 'warning') bucket.consoleWarnings.push(msg.text());
  });
  page.on('pageerror', (err) => bucket.pageErrors.push(String(err)));
  page.on('requestfailed', (req) => {
    // ignore aborted/cancelled which are often navigation noise
    const f = req.failure();
    bucket.failedRequests.push(`${req.method()} ${req.url()} :: ${f ? f.errorText : 'unknown'}`);
  });
  page.on('response', (resp) => {
    const s = resp.status();
    if (s >= 400) bucket.badResponses.push(`${s} ${resp.url()}`);
  });
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

for (const r of routes) {
  const bucket = {
    name: r.name, url: r.url, status: 'ok',
    consoleErrors: [], consoleWarnings: [], pageErrors: [],
    failedRequests: [], badResponses: [], httpStatus: null, title: null, notes: [],
  };
  const page = await ctx.newPage();
  attachListeners(page, bucket);
  try {
    const resp = await page.goto(BASE + r.url, { waitUntil: 'networkidle', timeout: 45000 });
    bucket.httpStatus = resp ? resp.status() : null;
    await page.waitForTimeout(1200);
    bucket.title = await page.title();
    // basic content sanity: body text length
    const textLen = (await page.evaluate(() => document.body.innerText.length)) || 0;
    bucket.notes.push(`bodyTextLen=${textLen}`);
    if (textLen < 50) bucket.status = 'warn-empty';
    await page.screenshot({ path: path.join(SHOT_DIR, `${r.name}.png`), fullPage: false });
  } catch (e) {
    bucket.status = 'error';
    bucket.notes.push('NAV ERROR: ' + String(e).split('\n')[0]);
  }
  await page.close();
  report.push(bucket);
  console.log(`[${bucket.status}] ${r.name} (${bucket.httpStatus}) errs=${bucket.pageErrors.length} consoleErr=${bucket.consoleErrors.length} bad=${bucket.badResponses.length}`);
}

// ---- Interaction tests on dashboard ----
const interact = { name: 'INTERACTIONS', steps: [], consoleErrors: [], pageErrors: [] };
const page = await ctx.newPage();
attachListeners(page, { consoleErrors: interact.consoleErrors, consoleWarnings: [], pageErrors: interact.pageErrors, failedRequests: [], badResponses: [] });
try {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1000);

  // Count interactive elements
  const counts = await page.evaluate(() => ({
    links: document.querySelectorAll('a').length,
    buttons: document.querySelectorAll('button').length,
    inputs: document.querySelectorAll('input').length,
    images: document.querySelectorAll('img').length,
  }));
  interact.steps.push(`dashboard elements: ${JSON.stringify(counts)}`);

  // Try clicking the first series/family card link that points to /cars
  const carLink = await page.$('a[href*="/cars/"]');
  if (carLink) {
    const href = await carLink.getAttribute('href');
    await carLink.click();
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1200);
    interact.steps.push(`clicked car link -> ${href} ; now at ${page.url()}`);
    await page.screenshot({ path: path.join(SHOT_DIR, 'interaction-after-click.png') });
  } else {
    interact.steps.push('NO /cars/ link found on dashboard');
  }

  // Try a search input if present
  await page.goto(BASE + '/search', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  const searchInput = await page.$('input[type="search"], input[type="text"], input[placeholder]');
  if (searchInput) {
    await searchInput.fill('911');
    await page.waitForTimeout(400);
    await searchInput.press('Enter').catch(() => {});
    await page.waitForTimeout(1500);
    interact.steps.push(`search typed '911' -> url ${page.url()}`);
    await page.screenshot({ path: path.join(SHOT_DIR, 'interaction-search.png') });
  } else {
    interact.steps.push('NO search input found on /search');
  }
} catch (e) {
  interact.steps.push('INTERACT ERROR: ' + String(e).split('\n')[0]);
}
await page.close();
report.push(interact);

// ---- Responsive check ----
const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const mpage = await mobileCtx.newPage();
const mb = { name: 'mobile-home', consoleErrors: [], pageErrors: [], notes: [] };
attachListeners(mpage, { consoleErrors: mb.consoleErrors, consoleWarnings: [], pageErrors: mb.pageErrors, failedRequests: [], badResponses: [] });
try {
  await mpage.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await mpage.waitForTimeout(1000);
  // detect horizontal overflow
  const overflow = await mpage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  mb.notes.push(`horizontalOverflowPx=${overflow}`);
  await mpage.screenshot({ path: path.join(SHOT_DIR, 'mobile-home.png'), fullPage: false });
} catch (e) {
  mb.notes.push('MOBILE ERROR: ' + String(e).split('\n')[0]);
}
await mpage.close();
report.push(mb);

await browser.close();

console.log('\n===== FULL REPORT =====');
console.log(JSON.stringify(report, null, 2));
