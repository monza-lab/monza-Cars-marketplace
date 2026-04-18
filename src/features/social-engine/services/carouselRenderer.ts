import chromium from "@sparticuz/chromium";
import { chromium as pw } from "playwright-core";
import { CAROUSEL } from "../config";
import { uploadSlidePng } from "./storageUploader";

async function launchBrowser() {
  const executablePath = process.env.CHROMIUM_PATH ?? (await chromium.executablePath());
  const headlessArgs = chromium.args;
  const browser = await pw.launch({
    executablePath,
    args: headlessArgs,
    headless: true,
  });
  return browser;
}

export async function renderCarousel(draftId: string, baseUrl: string): Promise<string[]> {
  const browser = await launchBrowser();
  try {
    const urls: string[] = [];
    for (let i = 1; i <= CAROUSEL.slideCount; i++) {
      const context = await browser.newContext({
        viewport: { width: CAROUSEL.width, height: CAROUSEL.height },
        deviceScaleFactor: CAROUSEL.deviceScaleFactor,
      });
      const page = await context.newPage();
      const target = `${baseUrl}/internal/carousel/${draftId}/${i}`;
      await page.goto(target, { waitUntil: "networkidle", timeout: 30_000 });
      await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<void> } }).fonts.ready);
      await page.waitForTimeout(500);

      const png = await page.screenshot({
        type: "png",
        fullPage: false,
        clip: { x: 0, y: 0, width: CAROUSEL.width, height: CAROUSEL.height },
      });
      const url = await uploadSlidePng(draftId, i, Buffer.from(png));
      urls.push(url);
      await context.close();
    }
    return urls;
  } finally {
    await browser.close();
  }
}
