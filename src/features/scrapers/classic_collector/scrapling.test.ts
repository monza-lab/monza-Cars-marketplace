import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

import { spawnSync } from "node:child_process";
import { fetchClassicDetailWithScrapling, canUseScraplingFallback } from "./scrapling";

const mockSpawnSync = vi.mocked(spawnSync);

describe("classic Scrapling wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VERCEL;
  });

  it("parses Scrapling JSON output", async () => {
    mockSpawnSync.mockReturnValueOnce({
      status: 0,
      stdout: JSON.stringify({
        ok: true,
        title: "2019 Porsche 911 GT3",
        bodyText: "FOR SALE\nby\nBonhams",
        images: ["https://images.classic.com/vehicles/one.jpg"],
      }),
      stderr: "",
    } as any);

    const content = await fetchClassicDetailWithScrapling("https://www.classic.com/veh/test");

    expect(content).toEqual({
      title: "2019 Porsche 911 GT3",
      bodyText: "FOR SALE\nby\nBonhams",
      images: ["https://images.classic.com/vehicles/one.jpg"],
    });
    expect(mockSpawnSync).toHaveBeenCalledTimes(1);
  });

  it("returns null when Scrapling is disabled in Vercel", async () => {
    process.env.VERCEL = "1";

    await expect(canUseScraplingFallback()).toBe(false);
    await expect(fetchClassicDetailWithScrapling("https://www.classic.com/veh/test")).resolves.toBeNull();
    expect(mockSpawnSync).not.toHaveBeenCalled();
  });
});
