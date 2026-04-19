#!/usr/bin/env tsx
/**
 * MonzaHaus Social Engine — Instagram Highlight Covers
 *
 * Renders 5 covers (1080×1080) whose initials spell M-O-N-Z-A.
 * Each cover uses the Salon brand tokens: Obsidian background with
 * subtle noise, Cormorant letter mark, burgundy separator, Karla label.
 *
 * Output: ~/Downloads/monzahaus-posts/highlights/
 *
 * Usage: npx tsx scripts/generate-highlight-covers.ts
 */

import { promises as fs, existsSync, readFileSync } from "fs";
import path from "path";
import chromium from "@sparticuz/chromium";
import { chromium as pw, type Browser } from "playwright-core";

function loadEnvFromFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
loadEnvFromFile(path.resolve(process.cwd(), ".env.local"));

interface Highlight {
  letter: string;
  label: string;
}

const HIGHLIGHTS: Highlight[] = [
  { letter: "M", label: "Market" },
  { letter: "O", label: "Origins" },
  { letter: "N", label: "New" },
  { letter: "Z", label: "Zeitgeist" },
  { letter: "A", label: "Archive" },
];

function buildCoverHtml(letter: string, label: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant:wght@300;400;500;600&family=Karla:wght@300;400;500;600;700&display=block" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1080px; height: 1080px; overflow: hidden; }
  body {
    background: #0E0A0C;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* Warm rose glow from above — subtle Salon vibe */
  body::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(45% 45% at 50% 38%, rgba(212,115,138,0.10) 0%, transparent 70%);
    pointer-events: none;
  }
  /* Noise texture */
  body::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
    opacity: 0.22;
    mix-blend-mode: overlay;
    pointer-events: none;
  }
  /* Safe circle guideline — NOT rendered in final PNG, just for reference during iteration */
  .content {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .letter {
    font-family: 'Cormorant', serif;
    font-weight: 300;
    font-size: 540px;
    color: #E8E2DE;
    line-height: 1;
    letter-spacing: -0.02em;
  }
</style>
</head>
<body>
  <div class="content">
    <div class="letter">${letter}</div>
  </div>
</body>
</html>`;
}

const MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
async function launchBrowser(): Promise<Browser> {
  let executablePath = process.env.CHROMIUM_PATH;
  if (!executablePath) {
    if (process.platform === "darwin" && existsSync(MAC_CHROME)) {
      executablePath = MAC_CHROME;
    } else {
      executablePath = await chromium.executablePath();
    }
  }
  const args = process.platform === "darwin" ? ["--no-sandbox"] : chromium.args;
  return pw.launch({ executablePath, args, headless: true });
}

async function renderCover(browser: Browser, h: Highlight, outPath: string): Promise<void> {
  const html = buildCoverHtml(h.letter, h.label);
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1080 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle", timeout: 30_000 });
    await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<void> } }).fonts.ready);
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({
      path: outPath,
      type: "png",
      fullPage: false,
      clip: { x: 0, y: 0, width: 1080, height: 1080 },
    });
  } finally {
    await context.close();
  }
}

async function main() {
  const root = path.join(process.env.HOME ?? process.cwd(), "Downloads", "monzahaus-posts");
  const outDir = path.join(root, "highlights");
  await fs.mkdir(outDir, { recursive: true });

  console.log(`[highlights] Rendering ${HIGHLIGHTS.length} covers to: ${outDir}`);
  const browser = await launchBrowser();
  try {
    for (const h of HIGHLIGHTS) {
      const filename = `highlight-${h.letter.toLowerCase()}-${h.label.toLowerCase()}.png`;
      const outPath = path.join(outDir, filename);
      await renderCover(browser, h, outPath);
      console.log(`  ✓ ${filename}`);
    }
  } finally {
    await browser.close();
  }
  console.log(`\n[highlights] Done.`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
