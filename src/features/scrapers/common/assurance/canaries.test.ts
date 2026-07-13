import { describe, expect, it, vi } from "vitest";

import type { AssuranceSource } from "./manifest";
import { redactCanaryOutput, runSourceCanary } from "./canaries";

function fakeSource(id: AssuranceSource["id"]): AssuranceSource {
  return {
    id,
    label: id,
    collectorJobIds: [],
    enrichmentJobIds: [],
    expectedCadenceHours: 24,
    maxRunMinutes: 5,
    requiredFields: [],
    unavailableFields: [],
    repairJobIds: [],
    canary: {
      command: "npx",
      args: ["tsx", "collector.ts", "--dryRun"],
      timeoutMs: 1_000,
    },
  };
}

describe("runSourceCanary", () => {
  it("sets canary mode, preserves dry-run, and classifies nonzero discovery", async () => {
    const execute = vi.fn(async () => ({
      exitCode: 0,
      stdout: "discovered=3 written=0",
      stderr: "",
      durationMs: 100,
      timedOut: false,
    }));
    const result = await runSourceCanary(fakeSource("AutoTrader"), execute);

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      args: expect.arrayContaining(["--dryRun"]),
      env: expect.objectContaining({ SCRAPER_ASSURANCE_CANARY: "1" }),
      shell: false,
    }));
    expect(result.status).toBe("healthy");
    expect(result.discovered).toBe(3);
    expect(result.ok).toBe(true);
  });

  it("classifies blocking output before empty discovery", async () => {
    const execute = vi.fn(async () => ({
      exitCode: 0,
      stdout: "discovered=0",
      stderr: "captcha challenge",
      durationMs: 100,
      timedOut: false,
    }));
    const result = await runSourceCanary(fakeSource("AutoTrader"), execute);

    expect(result.status).toBe("blocked");
    expect(result.ok).toBe(false);
  });

  it("classifies verified zero discovery as empty", async () => {
    const execute = vi.fn(async () => ({
      exitCode: 0,
      stdout: '{"discovered":0}',
      stderr: "",
      durationMs: 100,
      timedOut: false,
    }));
    const result = await runSourceCanary(fakeSource("BaT"), execute);
    expect(result.status).toBe("empty");
  });

  it("redacts credentials, authorization headers, cookies, and configured proxies", () => {
    const secretProxy = "http://proxy-user:proxy-pass@proxy.example:8080";
    const output = redactCanaryOutput(
      `url=https://alice:secret@example.test Bearer token-123 Cookie: sid=abc proxy=${secretProxy}`,
      { HTTPS_PROXY: secretProxy },
    );

    expect(output).not.toContain("secret");
    expect(output).not.toContain("token-123");
    expect(output).not.toContain("sid=abc");
    expect(output).not.toContain(secretProxy);
  });
});
