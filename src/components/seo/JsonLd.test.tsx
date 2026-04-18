import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  OrganizationJsonLd,
  BreadcrumbJsonLd,
  VehicleJsonLd,
  ArticleJsonLd,
  FAQPageJsonLd,
  DatasetJsonLd,
  CollectionPageJsonLd,
} from "./JsonLd";

function extract(html: string): Record<string, unknown>[] {
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  return Array.from(html.matchAll(re)).map((m) => JSON.parse(m[1]));
}

describe("OrganizationJsonLd", () => {
  it("emits Organization + WebSite + SoftwareApplication", () => {
    const html = renderToString(<OrganizationJsonLd />);
    const schemas = extract(html);
    expect(schemas).toHaveLength(3);
    expect(schemas.map((s) => s["@type"])).toEqual(
      expect.arrayContaining(["Organization", "WebSite", "SoftwareApplication"])
    );
  });
});

describe("BreadcrumbJsonLd", () => {
  it("emits BreadcrumbList with positions", () => {
    const html = renderToString(
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "https://monzalab.com/en" },
          { name: "Porsche", url: "https://monzalab.com/en/cars/porsche" },
        ]}
      />
    );
    const [schema] = extract(html);
    expect(schema["@type"]).toBe("BreadcrumbList");
    const items = schema.itemListElement as { position: number }[];
    expect(items[0].position).toBe(1);
    expect(items[1].position).toBe(2);
  });
});

describe("VehicleJsonLd", () => {
  it("includes Car type with required fields", () => {
    const html = renderToString(
      <VehicleJsonLd
        name="1989 Porsche 911 Carrera"
        description="Investment grade G-body 911"
        url="https://monzalab.com/en/cars/porsche/abc"
        brand="Porsche"
        model="911 Carrera"
        year={1989}
        price={85000}
        currency="USD"
      />
    );
    const [schema] = extract(html);
    expect(schema["@type"]).toBe("Car");
    expect(schema.name).toBe("1989 Porsche 911 Carrera");
    expect((schema.brand as { name: string }).name).toBe("Porsche");
    expect((schema.offers as { price: string }).price).toBe("85000");
  });
});

describe("ArticleJsonLd", () => {
  it("emits Article schema with author and publisher", () => {
    const html = renderToString(
      <ArticleJsonLd
        headline="Porsche 964 Buyer's Guide"
        description="Everything collectors need to know about the 964."
        url="https://monzalab.com/en/guides/porsche-964-buyers-guide"
        image="https://monzalab.com/og/964.jpg"
        datePublished="2026-04-18"
        dateModified="2026-04-18"
        authorName="MonzaHaus Editorial"
      />
    );
    const [schema] = extract(html);
    expect(schema["@type"]).toBe("Article");
    expect(schema.headline).toBe("Porsche 964 Buyer's Guide");
    expect((schema.publisher as { name: string }).name).toBe("MonzaHaus");
    expect((schema.author as { name: string }).name).toBe("MonzaHaus Editorial");
  });
});

describe("FAQPageJsonLd", () => {
  it("emits FAQPage with Question entries", () => {
    const html = renderToString(
      <FAQPageJsonLd
        questions={[
          { question: "Is a 964 a good investment?", answer: "Yes, for the right spec." },
          { question: "What is a fair price for a 993?", answer: "Depends on trim and miles." },
        ]}
      />
    );
    const [schema] = extract(html);
    expect(schema["@type"]).toBe("FAQPage");
    const mainEntity = schema.mainEntity as { "@type": string }[];
    expect(mainEntity).toHaveLength(2);
    expect(mainEntity[0]["@type"]).toBe("Question");
  });
});

describe("DatasetJsonLd", () => {
  it("emits Dataset schema with creator", () => {
    const html = renderToString(
      <DatasetJsonLd
        name="MonzaHaus Air-Cooled 911 Index"
        description="Historical market values for air-cooled Porsche 911 models."
        url="https://monzalab.com/en/index/air-cooled-911"
        keywords={["Porsche", "911", "collector", "market data"]}
        license="https://creativecommons.org/licenses/by/4.0/"
      />
    );
    const [schema] = extract(html);
    expect(schema["@type"]).toBe("Dataset");
    expect(schema.name).toBe("MonzaHaus Air-Cooled 911 Index");
    expect(Array.isArray(schema.keywords)).toBe(true);
    expect((schema.creator as { name: string }).name).toBe("MonzaHaus");
  });
});

describe("CollectionPageJsonLd", () => {
  it("emits CollectionPage schema", () => {
    const html = renderToString(
      <CollectionPageJsonLd
        name="Porsche 992 Collection"
        description="Investment-grade 992 series listings."
        url="https://monzalab.com/en/cars/porsche?series=992"
        numberOfItems={24}
      />
    );
    const [schema] = extract(html);
    expect(schema["@type"]).toBe("CollectionPage");
    expect(schema.name).toBe("Porsche 992 Collection");
    expect((schema.mainEntity as { numberOfItems: number }).numberOfItems).toBe(24);
  });
});
