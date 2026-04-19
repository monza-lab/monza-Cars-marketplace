#!/usr/bin/env tsx
/**
 * IndexNow bulk submit — pushes all sitemap URLs to the IndexNow protocol
 * which notifies Bing, Yandex, Seznam, Naver (and by extension any indexer
 * cooperating with IndexNow). Google does NOT participate directly — use
 * Search Console's sitemap submission for Google.
 *
 * Run: `npm run seo:indexnow`
 * Docs: https://www.indexnow.org
 */
import sitemap from "../src/app/sitemap";

const KEY = process.env.INDEXNOW_KEY ?? "142ba841b9e60590d23f26af5a9b53cb";
const HOST = process.env.INDEXNOW_HOST ?? "monzalab.com";
const KEY_LOCATION =
  process.env.INDEXNOW_KEY_LOCATION ?? `https://${HOST}/${KEY}.txt`;

async function main() {
  const entries = sitemap();
  const urlList = entries.map((e) => e.url);

  // IndexNow limits ~10,000 URLs per request. Chunk if needed.
  const chunkSize = 1000;
  let submitted = 0;
  let failed = 0;

  for (let i = 0; i < urlList.length; i += chunkSize) {
    const chunk = urlList.slice(i, i + chunkSize);
    const body = {
      host: HOST,
      key: KEY,
      keyLocation: KEY_LOCATION,
      urlList: chunk,
    };

    try {
      const res = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        submitted += chunk.length;
        console.log(`[indexnow] submitted ${chunk.length} URLs (HTTP ${res.status})`);
      } else {
        failed += chunk.length;
        const text = await res.text().catch(() => "");
        console.error(`[indexnow] FAIL HTTP ${res.status}: ${text}`);
      }
    } catch (err) {
      failed += chunk.length;
      console.error(`[indexnow] error:`, err);
    }
  }

  console.log(`\nDone. Submitted: ${submitted}, Failed: ${failed}, Total: ${urlList.length}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
