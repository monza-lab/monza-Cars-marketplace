import { describe, it, expect, vi } from "vitest";

// Mock next-intl/server with an inline translator that reads from en.json
vi.mock("next-intl/server", async () => {
  const enMessages = (await import("../../../messages/en.json")).default as Record<string, unknown>;
  const esMessages = (await import("../../../messages/es.json")).default as Record<string, unknown>;
  const deMessages = (await import("../../../messages/de.json")).default as Record<string, unknown>;
  const jaMessages = (await import("../../../messages/ja.json")).default as Record<string, unknown>;
  const byLocale: Record<string, Record<string, unknown>> = {
    en: enMessages,
    es: esMessages,
    de: deMessages,
    ja: jaMessages,
  };

  function getByPath(obj: Record<string, unknown>, path: string): string {
    const parts = path.split(".");
    let cur: unknown = obj;
    for (const p of parts) {
      if (cur && typeof cur === "object") cur = (cur as Record<string, unknown>)[p];
      else return path;
    }
    return typeof cur === "string" ? cur : path;
  }

  function interpolate(template: string, vars: Record<string, string> = {}): string {
    return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  }

  return {
    getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => {
      const messages = byLocale[locale] ?? byLocale.en;
      return (key: string, vars?: Record<string, string>) => {
        const full = namespace ? `${namespace}.${key}` : key;
        const template = getByPath(messages, full);
        return interpolate(template, vars);
      };
    },
  };
});

import { buildMakePageMetadata } from "./makePageMetadata";

describe("buildMakePageMetadata", () => {
  it("builds English title without series", async () => {
    const meta = await buildMakePageMetadata({ locale: "en", make: "porsche" });
    expect(meta.title).toContain("Porsche Collection");
    expect(meta.title).toContain("MonzaHaus");
  });

  it("builds Spanish title with series", async () => {
    const meta = await buildMakePageMetadata({
      locale: "es",
      make: "porsche",
      series: "992",
    });
    expect(meta.title).toContain("Porsche 992");
    expect(meta.title).toContain("Subastas");
  });

  it("emits hreflang alternates for all 4 locales and x-default", async () => {
    const meta = await buildMakePageMetadata({ locale: "en", make: "porsche" });
    expect(meta.alternates?.languages).toBeDefined();
    const langs = meta.alternates?.languages as Record<string, string>;
    expect(langs.en).toBeDefined();
    expect(langs.es).toBeDefined();
    expect(langs.de).toBeDefined();
    expect(langs.ja).toBeDefined();
    expect(langs["x-default"]).toBeDefined();
  });

  it("canonical points to locale-specific URL", async () => {
    const meta = await buildMakePageMetadata({ locale: "de", make: "porsche" });
    expect(meta.alternates?.canonical).toContain("/de/cars/porsche");
  });

  it("series query param is preserved in canonical and alternates", async () => {
    const meta = await buildMakePageMetadata({
      locale: "en",
      make: "porsche",
      series: "993",
    });
    expect(meta.alternates?.canonical).toContain("series=993");
    const langs = meta.alternates?.languages as Record<string, string>;
    expect(langs.de).toContain("series=993");
  });

  it("openGraph locale matches request locale", async () => {
    const meta = await buildMakePageMetadata({ locale: "ja", make: "porsche" });
    expect(meta.openGraph?.locale).toBe("ja_JP");
  });
});
