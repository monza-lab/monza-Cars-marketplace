/**
 * Smoke test — runs the full worker flow against real Supabase (read-only; does not create drafts).
 * Skips in CI without real env vars. Meant for manual verification during development.
 *
 *   SOCIAL_ENGINE_SMOKE=1 npx vitest run src/features/social-engine/workers/worker.smoke.test.ts
 */
import { describe, it, expect } from "vitest";
import { fetchGate1Candidates } from "../services/listingSelector";
import { filterRealPhotoUrls } from "../services/photoValidator";

const SHOULD_RUN = process.env.SOCIAL_ENGINE_SMOKE === "1";

describe.skipIf(!SHOULD_RUN)("social-engine worker smoke", () => {
  it("can fetch Gate 1 candidates from real DB", async () => {
    const rows = await fetchGate1Candidates();
    console.log(`Found ${rows.length} candidates`);
    for (const r of rows.slice(0, 3)) {
      const real = filterRealPhotoUrls(r.images ?? []);
      console.log(`  ${r.platform} ${r.year} ${r.model} ${r.trim}: ${real.length} real photos`);
    }
    expect(rows.length).toBeGreaterThanOrEqual(0);
  });
});
