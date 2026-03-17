import { describe, it, expect } from "vitest";

describe("backfillImages module", () => {
  it("exports backfillImagesForSource function", async () => {
    const mod = await import("./backfillImages");
    expect(typeof mod.backfillImagesForSource).toBe("function");
  });

  it("returns error when Supabase env vars are missing", async () => {
    // Temporarily remove env vars
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const origAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { backfillImagesForSource } = await import("./backfillImages");
    const result = await backfillImagesForSource({
      source: "BaT",
      maxListings: 1,
      delayMs: 0,
      timeBudgetMs: 5000,
    });

    expect(result.errors).toContain("Missing Supabase env vars");
    expect(result.discovered).toBe(0);

    // Restore
    if (origUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
    if (origKey) process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
    if (origAnon) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origAnon;
  });
});
