import { describe, it, expect, vi } from "vitest";

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

vi.mock("@/lib/stripHtml", () => ({
  stripHtml: (s: string) => s.replace(/<[^>]*>/g, ""),
}));

import { buildCarDetailMetadata } from "./carDetailMetadata";

describe("buildCarDetailMetadata", () => {
  it("uses localized template for Spanish", async () => {
    const meta = await buildCarDetailMetadata({
      locale: "es",
      make: "porsche",
      id: "abc",
      car: {
        title: "1989 Porsche 911 Carrera",
        make: "Porsche",
        model: "911 Carrera",
        year: 1989,
        thesis: "Investment grade G-body",
      },
    });
    expect(meta.title).toContain("Porsche");
    expect(meta.title).toContain("1989");
    expect(meta.title).toContain("MonzaHaus");
  });

  it("returns notFound-safe metadata when car is null", async () => {
    const meta = await buildCarDetailMetadata({
      locale: "en",
      make: "porsche",
      id: "missing",
      car: null,
    });
    expect(meta.title).toContain("Not Found");
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("emits hreflang alternates including x-default", async () => {
    const meta = await buildCarDetailMetadata({
      locale: "en",
      make: "porsche",
      id: "abc",
      car: {
        title: "1989 Porsche 911",
        make: "Porsche",
        model: "911",
        year: 1989,
        thesis: "G-body",
      },
    });
    const langs = meta.alternates?.languages as Record<string, string>;
    expect(langs["x-default"]).toContain("/en/cars/porsche/abc");
    expect(langs.ja).toContain("/ja/cars/porsche/abc");
  });

  it("openGraph includes car image when provided", async () => {
    const meta = await buildCarDetailMetadata({
      locale: "en",
      make: "porsche",
      id: "abc",
      car: {
        title: "1989 Porsche 911",
        make: "Porsche",
        model: "911",
        year: 1989,
        thesis: "G-body",
        image: "https://example.com/car.jpg",
      },
    });
    expect(meta.openGraph?.images).toBeDefined();
  });
});
