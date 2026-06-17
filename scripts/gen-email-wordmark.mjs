// Regenerates the MonzaHaus wordmark PNG used in transactional emails.
//
// Why a PNG: email clients (Gmail, Outlook, Yahoo, most webmail) strip inline
// <svg>, which dropped the helmet "O" and rendered the mark as "M NZAHAUS".
// This bakes the exact wordmark (M + official helmet + NZAHAUS, Saira 600,
// helmet shell #D6BEDC on cream) into a transparent high-DPI PNG.
//
// Uses Playwright (already a devDependency) — its headless screenshot proved
// far more reliable on macOS than puppeteer's.
//
// Output: public/email/monzahaus-wordmark.png  (display it at 160×28 in email)
// Run:    node scripts/gen-email-wordmark.mjs
import { chromium } from "playwright";
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FONT = pathToFileURL(join(ROOT, "public/fonts/monzahaus/Saira-SemiBold.ttf")).href;
const OUT_DIR = join(ROOT, "public/email");
const OUT = join(OUT_DIR, "monzahaus-wordmark.png");
mkdirSync(OUT_DIR, { recursive: true });

// Official helmet for a CREAM surface: shell #D6BEDC, visor + strap #0E0E0D.
const helmet = `
  <svg viewBox="0 0 120 121" style="display:block;width:100%;height:100%" xmlns="http://www.w3.org/2000/svg">
    <path d="M60 3C36 3 12 18 7 40C2 57 2 72 6 86L15 103C23 113 38 118 57 118L60 118L63 118C82 118 97 113 105 103L114 86C118 72 118 57 113 40C108 18 84 3 60 3Z" fill="#D6BEDC"/>
    <path d="M14 46C14 36 33 30 60 30C87 30 106 36 106 46L106 68C105 77 86 83 60 83C34 83 15 77 14 68Z" fill="#0E0E0D"/>
    <path d="M26 90Q60 86 94 90" stroke="#0E0E0D" stroke-width="3" stroke-linecap="round" fill="none"/>
  </svg>`;

const html = `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  @font-face { font-family:'Saira'; font-weight:600; src:url('${FONT}') format('truetype'); }
  html,body { margin:0; padding:0; background:transparent; }
  #wm { display:inline-flex; align-items:baseline; line-height:1; font-family:'Saira',sans-serif;
        font-weight:600; letter-spacing:0.025em; text-transform:uppercase; color:#141413;
        font-size:96px; padding:10px 12px; }
  .helmet { display:inline-block; width:0.78em; height:0.79em; margin:0 0.03em; transform:translateY(0.07em); }
</style></head>
<body><span id="wm" aria-label="MONZAHAUS"><span>M</span><span class="helmet">${helmet}</span><span>NZAHAUS</span></span></body></html>`;

const browser = await chromium.launch();
const context = await browser.newContext({ deviceScaleFactor: 3, viewport: { width: 1400, height: 400 } });
const page = await context.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(async () => { await document.fonts.ready; });
await page.locator("#wm").screenshot({ path: OUT, omitBackground: true });
console.log("Wrote", OUT);
await browser.close();
