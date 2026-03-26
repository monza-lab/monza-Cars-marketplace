#!/usr/bin/env node
/**
 * Generate favicon + OG social card assets using Puppeteer
 * Run: npx puppeteer node scripts/generate-assets.mjs
 */
import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '..', 'public');

async function main() {
  const browser = await puppeteer.launch({ headless: true });

  // ── 1. FAVICON (512x512 master, then resize) ──
  console.log('Generating favicon...');
  const faviconPage = await browser.newPage();
  await faviconPage.setViewport({ width: 512, height: 512, deviceScaleFactor: 1 });
  await faviconPage.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant:wght@600&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; }
        body {
          width: 512px;
          height: 512px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0E0A0C;
          overflow: hidden;
          position: relative;
        }
        /* Salon glow */
        body::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 35%, rgba(212,115,138,0.18) 0%, transparent 65%);
        }
        .m {
          font-family: 'Cormorant', serif;
          font-weight: 600;
          font-size: 380px;
          color: #E8E2DE;
          letter-spacing: -0.02em;
          line-height: 1;
          margin-top: 20px;
          position: relative;
          z-index: 1;
        }
      </style>
    </head>
    <body><div class="m">M</div></body>
    </html>
  `, { waitUntil: 'networkidle0' });

  // Wait for font to load
  await faviconPage.evaluateHandle('document.fonts.ready');
  await new Promise(r => setTimeout(r, 500));

  const faviconPath = resolve(PUBLIC, 'favicon-512.png');
  await faviconPage.screenshot({ path: faviconPath, type: 'png' });
  console.log('  ✓ favicon-512.png');

  // Generate sizes with sips (macOS native)
  const sizes = [
    { size: 180, name: 'apple-touch-icon.png' },
    { size: 192, name: 'favicon-192.png' },
    { size: 32, name: 'favicon-32.png' },
    { size: 16, name: 'favicon-16.png' },
  ];

  for (const { size, name } of sizes) {
    const outPath = resolve(PUBLIC, name);
    execSync(`sips -z ${size} ${size} "${faviconPath}" --out "${outPath}" 2>/dev/null`);
    console.log(`  ✓ ${name}`);
  }

  // Generate .ico from 16 + 32 using magick
  try {
    execSync(`magick "${resolve(PUBLIC, 'favicon-16.png')}" "${resolve(PUBLIC, 'favicon-32.png')}" "${resolve(PUBLIC, 'favicon.ico')}"`, { stdio: 'pipe' });
    console.log('  ✓ favicon.ico');
  } catch {
    console.log('  ⚠ favicon.ico skipped (magick not available — use favicon-32.png)');
  }

  await faviconPage.close();

  // ── 2. OG IMAGE (1200x630) ──
  console.log('Generating OG social card...');
  const ogPage = await browser.newPage();
  await ogPage.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });

  // Read the 911 image as base64
  const heroPath = resolve(PUBLIC, '911-hero.webp');
  const heroBase64 = readFileSync(heroPath).toString('base64');
  const heroDataUrl = `data:image/webp;base64,${heroBase64}`;

  await ogPage.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <link href="https://fonts.googleapis.com/css2?family=Cormorant:wght@300;400;500;600&family=Karla:wght@400;500;600&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          width: 1200px;
          height: 630px;
          overflow: hidden;
          font-family: 'Karla', sans-serif;
        }
        .og-card {
          position: relative;
          width: 1200px;
          height: 630px;
          background: #0E0A0C;
          overflow: hidden;
        }
        .bg-photo {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 40%;
          opacity: 0.35;
          filter: saturate(0.6) brightness(0.7);
        }
        .overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(to top, #0E0A0C 0%, rgba(14,10,12,0.95) 25%, rgba(14,10,12,0.5) 60%, rgba(14,10,12,0.7) 100%),
            radial-gradient(80% 50% at 50% 0%, rgba(212,115,138,0.12) 0%, transparent 60%),
            radial-gradient(ellipse at 0% 50%, rgba(14,10,12,0.6) 0%, transparent 50%),
            radial-gradient(ellipse at 100% 50%, rgba(14,10,12,0.6) 0%, transparent 50%);
        }
        .noise {
          position: absolute;
          inset: 0;
          opacity: 0.02;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
          background-size: 128px 128px;
        }
        .content {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 60px 72px;
        }
        .top-bar {
          position: absolute;
          top: 44px;
          left: 72px;
          right: 72px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .label {
          font-family: 'Karla', sans-serif;
          font-weight: 500;
          font-size: 12px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: rgba(232,226,222,0.5);
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 16px;
          border-radius: 100px;
          background: rgba(212,115,138,0.10);
          border: 1px solid rgba(212,115,138,0.20);
        }
        .pill-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #D4738A;
        }
        .pill-text {
          font-family: 'Karla', sans-serif;
          font-weight: 500;
          font-size: 11px;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: #D4738A;
        }
        .divider {
          width: 48px;
          height: 1px;
          background: rgba(212,115,138,0.4);
          margin-bottom: 24px;
        }
        .title {
          font-family: 'Cormorant', serif;
          font-weight: 400;
          font-size: 86px;
          letter-spacing: -0.02em;
          color: #E8E2DE;
          line-height: 1;
          margin-bottom: 20px;
        }
        .title span {
          color: #D4738A;
        }
        .tagline {
          font-family: 'Karla', sans-serif;
          font-weight: 500;
          font-size: 15px;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: rgba(232,226,222,0.55);
        }
        .bottom-accent {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent 0%, #D4738A 20%, #D4738A 80%, transparent 100%);
          opacity: 0.6;
        }
      </style>
    </head>
    <body>
      <div class="og-card">
        <img class="bg-photo" src="${heroDataUrl}" alt="">
        <div class="overlay"></div>
        <div class="noise"></div>
        <div class="content">
          <div class="top-bar">
            <div class="label">Collector Car Intelligence</div>
            <div class="pill">
              <div class="pill-dot"></div>
              <span class="pill-text">AI-Powered</span>
            </div>
          </div>
          <div class="divider"></div>
          <div class="title">Monza<span>Haus</span></div>
          <div class="tagline">Investment-Grade Automotive Assets</div>
        </div>
        <div class="bottom-accent"></div>
      </div>
    </body>
    </html>
  `, { waitUntil: 'networkidle0' });

  await ogPage.evaluateHandle('document.fonts.ready');
  await new Promise(r => setTimeout(r, 500));

  const ogPath = resolve(PUBLIC, 'og-image.png');
  await ogPage.screenshot({ path: ogPath, type: 'png' });
  console.log('  ✓ og-image.png (2400x1260 @2x)');

  // Also generate a 1x version
  await ogPage.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await new Promise(r => setTimeout(r, 200));
  const og1xPath = resolve(PUBLIC, 'og-image-1x.png');
  await ogPage.screenshot({ path: og1xPath, type: 'png' });
  console.log('  ✓ og-image-1x.png (1200x630 @1x)');

  await ogPage.close();
  await browser.close();

  console.log('\n✅ All assets generated in /public');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
