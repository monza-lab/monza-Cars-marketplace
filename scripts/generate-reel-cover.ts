#!/usr/bin/env tsx
/**
 * MonzaHaus — Reel Cover Generator
 *
 * Renders a 1080×1920 (9:16) Reel cover with editorial typography
 * over a darkened background image + rose glow.
 *
 * The grid-visible crop is the central 4:5 — keep critical content centered.
 *
 * Usage:   npx tsx scripts/generate-reel-cover.ts
 * Config:  edit CONTENT below.
 * Output:  ~/Downloads/monzahaus-posts/reel-covers/
 */

import { promises as fs, existsSync, readFileSync } from "fs";
import path from "path";
import chromium from "@sparticuz/chromium";
import { chromium as pw, type Browser } from "playwright-core";

/* ─── CONTENT ─────────────────────────────────────── */
const CONTENT = {
  // Lines of the main headline. Line 3 is the accent line (rose color).
  lines: ["A new platform", "for collectors.", "Being built."],
  accentLine: 2, // index of the line rendered in rose

  // Background frame — absolute path to a jpg. Leave empty for pure obsidian.
  backgroundImage: "/tmp/reel-bg.jpg",

  // Brand mark top-right
  brandMark: "MonzaHaus",

  // Bottom domain
  domain: "monzahaus.com",

  // Output filename (relative to reel-covers dir)
  filename: "cover-01-a-new-platform.png",
};
/* ─────────────────────────────────────────────────── */

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

function bgLayer(): string {
  if (!CONTENT.backgroundImage || !existsSync(CONTENT.backgroundImage)) return "";
  const data = readFileSync(CONTENT.backgroundImage).toString("base64");
  const mime = CONTENT.backgroundImage.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  return `<div class="bg-photo" style="background-image:url('data:${mime};base64,${data}')"></div>`;
}

function buildHtml(): string {
  const linesHtml = CONTENT.lines
    .map((line, i) => `<div class="line${i === CONTENT.accentLine ? " accent" : ""}">${line}</div>`)
    .join("");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant:wght@300;400;500;600&family=Karla:wght@300;400;500;600;700&family=Geist+Mono&display=block" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1080px; height: 1920px; overflow: hidden; }
  body {
    background: #0E0A0C;
    position: relative;
    font-family: 'Karla', sans-serif;
    color: #E8E2DE;
  }

  /* Background photo — Porsche as the hero, muted but visible */
  .bg-photo {
    position: absolute; inset: 0;
    background-size: cover; background-position: center;
    opacity: 0.95;
    filter: saturate(0.65) contrast(1.08) brightness(0.65);
  }

  /* Color-wash: burgundy tint over the whole image to push Salon mood */
  .tint {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(92,26,51,0.25) 0%, rgba(14,10,12,0.15) 40%, rgba(14,10,12,0.35) 100%);
    mix-blend-mode: multiply;
    pointer-events: none;
  }

  /* Rose glow from top-right — atmospheric */
  .glow {
    position: absolute; inset: 0;
    background: radial-gradient(50% 40% at 85% 15%, rgba(212,115,138,0.35) 0%, rgba(122,46,74,0.12) 40%, transparent 70%);
    pointer-events: none;
  }

  /* Band of darkness behind the headline (center) so text is legible */
  .text-band {
    position: absolute;
    top: 28%; bottom: 28%;
    left: 0; right: 0;
    background: linear-gradient(180deg, rgba(14,10,12,0) 0%, rgba(14,10,12,0.72) 28%, rgba(14,10,12,0.78) 72%, rgba(14,10,12,0) 100%);
    pointer-events: none;
  }

  /* Bottom dark fade for footer legibility */
  .bottom-fade {
    position: absolute;
    bottom: 0; left: 0; right: 0; height: 240px;
    background: linear-gradient(180deg, transparent 0%, rgba(14,10,12,0.85) 80%);
    pointer-events: none;
  }

  /* Top dark fade for brand mark + kicker legibility */
  .top-fade {
    position: absolute;
    top: 0; left: 0; right: 0; height: 240px;
    background: linear-gradient(180deg, rgba(14,10,12,0.78) 0%, transparent 100%);
    pointer-events: none;
  }

  /* Noise */
  .noise {
    position: absolute; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
    opacity: 0.18;
    mix-blend-mode: overlay;
    pointer-events: none;
  }

  /* Top brand mark */
  .brand {
    position: absolute;
    top: 80px; right: 80px;
    z-index: 5;
    font-family: 'Cormorant', serif;
    font-weight: 500;
    font-size: 42px;
    letter-spacing: -0.02em;
    color: #E8E2DE;
  }

  /* Optional small kicker above headline */
  .kicker {
    position: absolute;
    top: 88px; left: 80px;
    z-index: 5;
    font-size: 20px;
    font-weight: 500;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: #D4738A;
  }

  /* Main headline — vertically centered */
  .headline {
    position: absolute;
    top: 50%; left: 80px; right: 80px;
    transform: translateY(-50%);
    z-index: 4;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .line {
    font-family: 'Cormorant', serif;
    font-weight: 300;
    font-size: 176px;
    line-height: 1.02;
    letter-spacing: -0.025em;
    color: #E8E2DE;
  }
  .line.accent {
    color: #D4738A;
    font-style: italic;
    font-weight: 400;
  }

  /* Bottom block */
  .bottom {
    position: absolute;
    bottom: 100px; left: 80px; right: 80px;
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .bottom .line-mark {
    width: 80px;
    height: 1.5px;
    background: #7A2E4A;
  }
  .bottom .domain {
    font-family: 'Geist Mono', monospace;
    font-size: 20px;
    letter-spacing: 0.1em;
    color: #D4738A;
    text-transform: lowercase;
  }
</style>
</head>
<body>
  ${bgLayer()}
  <div class="tint"></div>
  <div class="glow"></div>
  <div class="top-fade"></div>
  <div class="text-band"></div>
  <div class="bottom-fade"></div>
  <div class="noise"></div>

  <div class="kicker">In the studio</div>
  <div class="brand">${CONTENT.brandMark}</div>

  <div class="headline">${linesHtml}</div>

  <div class="bottom">
    <div class="line-mark"></div>
    <div class="domain">${CONTENT.domain}</div>
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

async function main() {
  const root = path.join(process.env.HOME ?? process.cwd(), "Downloads", "monzahaus-posts");
  const outDir = path.join(root, "reel-covers");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, CONTENT.filename);

  console.log(`[reel-cover] Rendering → ${outPath}`);
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport: { width: 1080, height: 1920 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.setContent(buildHtml(), { waitUntil: "networkidle", timeout: 30_000 });
    await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<void> } }).fonts.ready);
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({
      path: outPath,
      type: "png",
      fullPage: false,
      clip: { x: 0, y: 0, width: 1080, height: 1920 },
    });
    await context.close();
  } finally {
    await browser.close();
  }
  console.log(`[reel-cover] ✓ Done`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
