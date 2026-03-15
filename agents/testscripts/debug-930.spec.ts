import { test } from "@playwright/test";

test("debug 930 Turbo listings", async ({ request }) => {
  test.setTimeout(60_000);

  const resp = await request.get("/api/mock-auctions");
  const apiData = await resp.json();

  const auctions = apiData.auctions as any[];
  console.log(`\nTotal auctions from API: ${auctions.length}`);

  // Filter to 930 family using same logic as DashboardClient
  const family930 = auctions.filter((a: any) => {
    const model = (a.model || "").toLowerCase();
    return model.includes("930");
  });

  console.log(`\n${"=".repeat(100)}`);
  console.log(`930 FAMILY LISTINGS (model contains "930"): ${family930.length}`);
  console.log(`${"=".repeat(100)}`);

  family930.sort((a: any, b: any) => {
    if (a.region !== b.region) return (a.region || "").localeCompare(b.region || "");
    return (b.currentBid || 0) - (a.currentBid || 0);
  });

  for (const a of family930) {
    console.log(
      [
        `Region=${(a.region || "?").padEnd(3)}`,
        `Status=${(a.status || "?").padEnd(12)}`,
        `Bid=$${(a.currentBid || 0).toLocaleString().padStart(10)}`,
        `Currency=${(a.originalCurrency || "null").padEnd(4)}`,
        `Platform=${(a.platform || "?").padEnd(20)}`,
        `Year=${a.year}`,
        `Model="${a.model}"`,
      ].join(" | ")
    );
  }

  // Region breakdown with median calc
  const byRegion: Record<string, any[]> = {};
  for (const a of family930) {
    const r = a.region || "?";
    if (!byRegion[r]) byRegion[r] = [];
    byRegion[r].push(a);
  }

  console.log(`\n${"=".repeat(100)}`);
  console.log("REGION BREAKDOWN");
  console.log(`${"=".repeat(100)}`);

  for (const [region, items] of Object.entries(byRegion)) {
    const ended = items.filter((a: any) => a.status === "ENDED");
    const active = items.filter((a: any) => a.status === "ACTIVE" || a.status === "ENDING_SOON");
    const endedBids = ended.filter((a: any) => a.currentBid > 0).map((a: any) => a.currentBid);
    const activeBids = active.filter((a: any) => a.currentBid > 0).map((a: any) => a.currentBid);

    console.log(`\n  ${region}: ${items.length} total (${ended.length} ended, ${active.length} active)`);
    if (endedBids.length > 0) {
      endedBids.sort((a: number, b: number) => a - b);
      const mid = Math.floor(endedBids.length / 2);
      const median = endedBids.length % 2 !== 0 ? endedBids[mid] : (endedBids[mid - 1] + endedBids[mid]) / 2;
      console.log(`    Ended bids: [${endedBids.map((b: number) => `$${b.toLocaleString()}`).join(", ")}]`);
      console.log(`    Median (ended): $${median.toLocaleString()}`);
    } else {
      console.log(`    No ended listings with bids`);
    }
    if (activeBids.length > 0) {
      activeBids.sort((a: number, b: number) => a - b);
      const mid = Math.floor(activeBids.length / 2);
      const median = activeBids.length % 2 !== 0 ? activeBids[mid] : (activeBids[mid - 1] + activeBids[mid]) / 2;
      console.log(`    Active bids: [${activeBids.map((b: number) => `$${b.toLocaleString()}`).join(", ")}]`);
      console.log(`    Median (active): $${median.toLocaleString()}`);
    } else {
      console.log(`    No active listings with bids`);
    }
    const currencies = [...new Set(items.map((a: any) => a.originalCurrency || "null"))];
    console.log(`    Currencies: ${currencies.join(", ")}`);
  }

  // Check: 911 Turbo 1975-1989 that DON'T match "930" keyword
  const turbo7589 = auctions.filter((a: any) => {
    const model = (a.model || "").toLowerCase();
    const year = a.year || 0;
    const make = (a.make || "").toLowerCase();
    return make === "porsche" && !model.includes("930") && (model.includes("turbo") || model.includes("911 turbo")) && year >= 1975 && year <= 1989;
  });

  if (turbo7589.length > 0) {
    console.log(`\n${"=".repeat(100)}`);
    console.log(`911 TURBO 1975-1989 NOT MATCHED AS "930": ${turbo7589.length}`);
    console.log(`These cars ARE 930s but don't have "930" in the model field`);
    console.log(`${"=".repeat(100)}`);
    turbo7589.sort((a: any, b: any) => (a.year || 0) - (b.year || 0));
    for (const a of turbo7589) {
      console.log(
        `  Region=${(a.region || "?").padEnd(3)} | Status=${(a.status || "?").padEnd(12)} | Bid=$${(a.currentBid || 0).toLocaleString().padStart(10)} | Currency=${(a.originalCurrency || "null").padEnd(4)} | Year=${a.year} | Model="${a.model}"`
      );
    }
  } else {
    console.log(`\nNo 1975-1989 Turbo models found outside the "930" keyword match.`);
  }

  // Full picture: ALL Porsche 1975-1989 with 911/930/turbo in model
  const all7589 = auctions.filter((a: any) => {
    const year = a.year || 0;
    const make = (a.make || "").toLowerCase();
    const model = (a.model || "").toLowerCase();
    return make === "porsche" && year >= 1975 && year <= 1989 && (model.includes("911") || model.includes("930") || model.includes("turbo"));
  });

  console.log(`\n${"=".repeat(100)}`);
  console.log(`ALL PORSCHE 911/930/TURBO 1975-1989: ${all7589.length}`);
  console.log(`${"=".repeat(100)}`);
  all7589.sort((a: any, b: any) => {
    const modelA = (a.model || "").toLowerCase();
    const modelB = (b.model || "").toLowerCase();
    const is930a = modelA.includes("930") ? 0 : 1;
    const is930b = modelB.includes("930") ? 0 : 1;
    if (is930a !== is930b) return is930a - is930b;
    return (a.year || 0) - (b.year || 0);
  });
  for (const a of all7589) {
    const is930 = (a.model || "").toLowerCase().includes("930");
    console.log(
      `  ${is930 ? "→930" : "    "} | Region=${(a.region || "?").padEnd(3)} | Status=${(a.status || "?").padEnd(12)} | Bid=$${(a.currentBid || 0).toLocaleString().padStart(10)} | Currency=${(a.originalCurrency || "null").padEnd(4)} | Year=${a.year} | Model="${a.model}"`
    );
  }
});
