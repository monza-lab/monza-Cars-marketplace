import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
  spawnSync: vi.fn(),
}));

import { execFile } from "node:child_process";
import { fetchClassicDetailWithScrapling, canUseScraplingFallback } from "./scrapling";

const mockExecFile = vi.mocked(execFile);

describe("classic Scrapling wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VERCEL;
  });

  it("parses Scrapling JSON output", async () => {
    mockExecFile.mockImplementationOnce((_cmd, _args, _opts, callback) => {
      callback(null, {
        stdout: JSON.stringify({
          ok: true,
          title: "2019 Porsche 911 GT3",
          bodyText: "FOR SALE\nby\nBonhams",
          images: ["https://images.classic.com/vehicles/one.jpg"],
        }),
      }, "");
      return {} as any;
    });

    const content = await fetchClassicDetailWithScrapling("https://www.classic.com/veh/test");

    expect(content).toEqual({
      title: "2019 Porsche 911 GT3",
      bodyText: "FOR SALE\nby\nBonhams",
      images: ["https://images.classic.com/vehicles/one.jpg"],
    });
    expect(mockExecFile).toHaveBeenCalledTimes(1);
  });

  it("returns null when Scrapling is disabled in Vercel", async () => {
    process.env.VERCEL = "1";

    await expect(canUseScraplingFallback()).toBe(false);
    await expect(fetchClassicDetailWithScrapling("https://www.classic.com/veh/test")).resolves.toBeNull();
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it("uses SCRAPLING_PYTHON when provided", async () => {
    process.env.SCRAPLING_PYTHON = "python3.11";

    mockExecFile.mockImplementationOnce((_cmd, _args, _opts, callback) => {
      callback(null, {
        stdout: JSON.stringify({
          ok: true,
          title: "2021 Porsche 911 Turbo S",
          bodyText: "FOR SALE\nby\nBonhams",
          images: [],
        }),
      }, "");
      return {} as any;
    });

    await fetchClassicDetailWithScrapling("https://www.classic.com/veh/test");

    const call = mockExecFile.mock.calls[0];
    expect(call[0]).toContain("/bin/zsh");
    expect(call[1]).toHaveLength(2);
    expect(call[1][0]).toBe("-lc");
    expect(call[1][1]).toContain("python3.11");
    expect(call[1][1]).toContain("scripts/classic_scrapling_fetch.py");
    expect(call[1][1]).toContain("https://www.classic.com/veh/test");
    expect(call[2]).toEqual(expect.objectContaining({
      timeout: 120000,
      encoding: "utf8",
      env: expect.objectContaining({
        SCRAPLING_PYTHON: "python3.11",
      }),
    }));
    expect(typeof call[3]).toBe("function");
  });
});
