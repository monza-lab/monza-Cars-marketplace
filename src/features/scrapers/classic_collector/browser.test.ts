import { describe, it, expect } from "vitest";
import { buildLaunchOptions } from "./browser";

describe("classic_collector buildLaunchOptions", () => {
  it("does not include proxy when proxyServer is missing", () => {
    const opts = buildLaunchOptions({ headless: true });
    expect(opts.proxy).toBeUndefined();
  });

  it("includes proxy when proxyServer is set", () => {
    const opts = buildLaunchOptions({
      headless: true,
      proxyServer: "http://gate.smartproxy.com:7000",
      proxyUsername: "user",
      proxyPassword: "pass",
    });

    expect(opts.proxy).toEqual({
      server: "http://gate.smartproxy.com:7000",
      username: "user",
      password: "pass",
    });
  });
});

