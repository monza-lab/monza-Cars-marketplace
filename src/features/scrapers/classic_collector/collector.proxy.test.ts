import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { preflightProxy } from "./collector";

vi.mock("undici", () => ({
  ProxyAgent: class {
    close() {}
  },
}));

vi.mock("./logging", () => ({
  logEvent: vi.fn(),
}));

const baseConfig = {
  mode: "daily",
  make: "Porsche",
  location: "US",
  status: "forsale",
  maxPages: 1,
  maxListings: 1,
  headless: true,
  navigationDelayMs: 1000,
  pageTimeoutMs: 10000,
  checkpointPath: "/tmp/classic_collector/checkpoint.json",
  outputPath: "/tmp/classic_collector/listings.jsonl",
  dryRun: true,
};

describe("classic_collector proxy preflight", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns skip when proxyServer is not configured", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy as unknown as typeof fetch);

    const result = await preflightProxy(baseConfig, "run-1");

    expect(result.usedProxy).toBe(false);
    expect(result.config.proxyServer).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back when proxy returns 407", async () => {
    const response = {
      status: 407,
      ok: false,
      text: vi.fn().mockResolvedValue("Proxy auth required"),
    } as unknown as Response;
    const fetchSpy = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchSpy as unknown as typeof fetch);

    const result = await preflightProxy(
      {
        ...baseConfig,
        proxyServer: "http://gate.decodo.com:7000",
        proxyUsername: "user",
        proxyPassword: "pass",
      },
      "run-2"
    );

    expect(result.usedProxy).toBe(false);
    expect(result.config.proxyServer).toBeUndefined();
    expect(result.fallbackReason).toContain("407");
  });

  it("throws on non-407 proxy errors", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error("connect ETIMEDOUT"));
    vi.stubGlobal("fetch", fetchSpy as unknown as typeof fetch);

    await expect(
      preflightProxy(
        {
          ...baseConfig,
          proxyServer: "http://gate.decodo.com:7000",
          proxyUsername: "user",
          proxyPassword: "pass",
        },
        "run-3"
      )
    ).rejects.toThrow("connect ETIMEDOUT");
  });
});
