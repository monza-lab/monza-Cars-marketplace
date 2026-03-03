import { chromium } from "playwright";

async function diagnose() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const targetUrl = "https://www.classic.com/veh/2005-porsche-carrera-gt-wp0ca298x5l001385-peDZywW";
  console.log(`Navigating to: ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 45000 });
  await new Promise((r) => setTimeout(r, 3000));

  // DOM analysis (safe for SVG elements)
  const domAnalysis = await page.evaluate(() => {
    const body = document.body.innerText;

    const prices = body.match(/\$[\d,]+/g) || [];
    const auctionHouses = body.match(/(Bring a Trailer|BaT|RM Sotheby|Mecum|Bonhams|Gooding|PCarMarket|Cars & Bids|Barrett.Jackson|Hemmings|duPont|Classic Driver|eBay|Collecting Cars|Broad Arrow)/gi) || [];
    const locations = body.match(/[A-Z][a-z]+(?:\s[A-Z][a-z]+)?,\s*[A-Z]{2}\b/g) || [];
    const mileages = body.match(/[\d,]+\s*(?:miles|mi\b|km)/gi) || [];

    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4")).map(
      (el) => `${el.tagName}: ${(el.textContent || "").trim().slice(0, 150)}`
    );

    // Find JSON-LD
    const jsonLd: string[] = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
      jsonLd.push((el.textContent || "").slice(0, 2000));
    });

    // Find spec-like key-value pairs
    const specSections: string[] = [];
    document.querySelectorAll("dt, th").forEach((el) => {
      const key = (el.textContent || "").trim();
      const next = el.nextElementSibling;
      const value = next ? (next.textContent || "").trim() : "";
      if (key && value && key.length < 50) {
        specSections.push(`${key}: ${value.slice(0, 100)}`);
      }
    });

    // Look for __NUXT_DATA__ in script tags
    let nuxtDataScript = "";
    document.querySelectorAll("script").forEach((el) => {
      const text = el.textContent || "";
      if (text.includes("__NUXT") || text.includes("nuxt") || text.includes("payload")) {
        nuxtDataScript += text.slice(0, 2000) + "\n---\n";
      }
    });

    // Check for any data attributes on the main content
    const dataAttrs: string[] = [];
    document.querySelectorAll("[data-price], [data-mileage], [data-vin], [data-location], [data-year], [data-make], [data-model]").forEach((el) => {
      const attrs = Array.from(el.attributes)
        .filter((a) => a.name.startsWith("data-"))
        .map((a) => `${a.name}=${a.value}`);
      dataAttrs.push(attrs.join(", "));
    });

    return {
      prices: prices.slice(0, 10),
      auctionHouses: [...new Set(auctionHouses)],
      locations: locations.slice(0, 10),
      mileages: mileages.slice(0, 5),
      headings,
      jsonLd,
      specSections: specSections.slice(0, 30),
      nuxtDataScript: nuxtDataScript.slice(0, 3000),
      dataAttrs: dataAttrs.slice(0, 10),
      bodyTextSample: body.slice(0, 4000),
    };
  });

  console.log("\n=== Prices Found ===");
  console.log(domAnalysis.prices);

  console.log("\n=== Auction Houses Found ===");
  console.log(domAnalysis.auctionHouses);

  console.log("\n=== Locations Found ===");
  console.log(domAnalysis.locations);

  console.log("\n=== Mileages Found ===");
  console.log(domAnalysis.mileages);

  console.log("\n=== Headings ===");
  console.log(domAnalysis.headings);

  console.log("\n=== JSON-LD ===");
  for (const ld of domAnalysis.jsonLd) console.log(ld);

  console.log("\n=== Spec Sections ===");
  console.log(domAnalysis.specSections);

  console.log("\n=== Nuxt Data Scripts ===");
  console.log(domAnalysis.nuxtDataScript || "(none)");

  console.log("\n=== Data Attributes ===");
  console.log(domAnalysis.dataAttrs);

  console.log("\n=== Body Text (first 4000 chars) ===");
  console.log(domAnalysis.bodyTextSample);

  await browser.close();
}

diagnose().catch(console.error);
