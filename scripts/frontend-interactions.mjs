// Deeper interaction checks. Dismisses onboarding overlays first.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.join(__dirname, '..', '.frontend-check');
mkdirSync(SHOT_DIR, { recursive: true });

const log = [];
const note = (m) => { log.push(m); console.log(m); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const errs = [];
const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push('PAGEERR: ' + String(e).split('\n')[0]));
page.on('console', (m) => { if (m.type() === 'error' && !/MISSING_MESSAGE/.test(m.text())) errs.push('CONSOLE: ' + m.text().split('\n')[0]); });

async function dismissOverlays() {
  // cookie banner: reject all
  for (const label of ['Reject all', 'Reject All', 'Accept all']) {
    const b = page.getByRole('button', { name: label }).first();
    if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await page.waitForTimeout(300); break; }
  }
  // welcome modal: Start Exploring or close (X)
  for (const label of ['Start Exploring', 'Close', 'Explore']) {
    const b = page.getByRole('button', { name: label }).first();
    if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await page.waitForTimeout(300); break; }
  }
  // any leftover dialog close button
  const x = page.locator('[aria-label="Close"], button:has-text("×")').first();
  if (await x.count().catch(() => 0)) { await x.click().catch(() => {}); await page.waitForTimeout(200); }
}

try {
  // 1) Landing CTA navigation
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  await dismissOverlays();
  const cta = page.getByRole('button', { name: /Explore the Market/i }).first();
  const ctaLink = page.getByRole('link', { name: /Explore the Market/i }).first();
  if (await cta.count()) { await cta.click(); }
  else if (await ctaLink.count()) { await ctaLink.click(); }
  else { note('!! Explore the Market CTA not found'); }
  await page.waitForTimeout(2500);
  note(`After 'Explore the Market' -> ${page.url()}`);
  await page.screenshot({ path: path.join(SHOT_DIR, 'flow-1-explore.png') });

  // 2) Go to cars page explicitly and test sidebar series filter
  await page.goto(BASE + '/cars/porsche', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  await dismissOverlays();
  await page.waitForTimeout(500);
  // count car cards before
  const beforeCards = await page.locator('a[href*="/cars/porsche/"], [data-testid="car-card"]').count().catch(() => 0);
  note(`cars/porsche initial card-ish links: ${beforeCards}`);

  // click a series in the sidebar (e.g., 911 family or 992)
  const series = page.getByRole('button', { name: /^992$/ }).first();
  if (await series.count()) {
    await series.click().catch(() => {});
    await page.waitForTimeout(1500);
    note(`clicked series 992 -> ${page.url()}`);
  } else {
    note('series 992 button not found in sidebar (may be a link)');
  }
  await page.screenshot({ path: path.join(SHOT_DIR, 'flow-2-series.png') });

  // 3) Sort dropdown
  const sortBtn = page.getByRole('button', { name: /Sort|Ending Soon|Newest|Price/i }).first();
  if (await sortBtn.count()) {
    await sortBtn.click().catch(() => {});
    await page.waitForTimeout(800);
    note('opened sort control');
    await page.screenshot({ path: path.join(SHOT_DIR, 'flow-3-sort.png') });
    await page.keyboard.press('Escape').catch(() => {});
  } else { note('sort control not found'); }

  // 4) Filter accordion (Price/Year/etc.)
  const priceFilter = page.getByRole('button', { name: /^PRICE$/i }).first();
  if (await priceFilter.count()) { await priceFilter.click().catch(() => {}); await page.waitForTimeout(600); note('toggled PRICE filter accordion'); }
  else { note('PRICE filter accordion not found'); }

  // 5) Click first car card -> detail
  const firstCar = page.locator('a[href*="/cars/porsche/"]').first();
  if (await firstCar.count()) {
    const href = await firstCar.getAttribute('href');
    await firstCar.click().catch(() => {});
    await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);
    note(`opened car detail ${href} -> ${page.url()}`);
    await page.screenshot({ path: path.join(SHOT_DIR, 'flow-4-detail.png'), fullPage: false });
  } else { note('no car detail link found to click'); }

  // 6) Search filtering
  await page.goto(BASE + '/search', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  await dismissOverlays();
  const input = page.locator('input').first();
  if (await input.count()) {
    const resBefore = await page.locator('a[href*="/cars/"]').count().catch(() => 0);
    await input.fill('911');
    await page.waitForTimeout(1800);
    const resAfter = await page.locator('a[href*="/cars/"]').count().catch(() => 0);
    note(`search '911': result links before=${resBefore} after=${resAfter}`);
    await page.screenshot({ path: path.join(SHOT_DIR, 'flow-5-search.png') });
  } else { note('no search input found'); }

} catch (e) {
  note('FLOW ERROR: ' + String(e).split('\n')[0]);
}

note('--- JS errors during interactions: ' + (errs.length ? JSON.stringify(errs, null, 2) : 'none'));
await browser.close();
