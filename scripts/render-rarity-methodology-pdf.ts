import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const sourcePath = resolve(process.cwd(), "public/rarity-methodology.html");
const outputDirectory = resolve(process.cwd(), "output/pdf");
const outputPath = resolve(outputDirectory, "monzahaus-rarity-methodology.pdf");

async function main(): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(pathToFileURL(sourcePath).href, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: outputPath,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      tagged: true,
    });
  } finally {
    await browser.close();
  }

  console.log(`[rarity-methodology] wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
