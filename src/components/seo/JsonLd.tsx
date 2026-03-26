/**
 * JSON-LD Structured Data for MonzaHaus
 * Helps Google understand what the platform is and enables rich results.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com";

/** Organization + WebSite + SearchAction — renders in root layout */
export function OrganizationJsonLd() {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "MonzaHaus",
    url: BASE_URL,
    logo: `${BASE_URL}/favicon-512.png`,
    description:
      "AI-powered collector car intelligence platform. Track Porsche auction results, analyze market trends, and discover investment-grade vehicles.",
    foundingDate: "2024",
    sameAs: [
      // Add social profiles when available
      // "https://www.instagram.com/monzahaus",
      // "https://www.linkedin.com/company/monzahaus",
      // "https://x.com/monzahaus",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      availableLanguage: ["English", "Spanish", "German", "Japanese"],
    },
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "MonzaHaus",
    url: BASE_URL,
    description:
      "Collector car market intelligence platform with AI-powered auction analysis for Porsche 911, 992, 997, and other investment-grade vehicles.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/en/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    inLanguage: ["en", "es", "de", "ja"],
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "MonzaHaus",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    url: BASE_URL,
    description:
      "Investment-grade automotive asset intelligence. AI-powered analysis of collector car auctions, market trends, and vehicle provenance.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free access to collector car market data",
    },
    aggregateRating: undefined, // Add when you have ratings
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
    </>
  );
}

/** BreadcrumbList — use on inner pages */
export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/** Vehicle listing — use on car detail pages */
export function VehicleJsonLd({
  name,
  description,
  image,
  url,
  brand,
  model,
  year,
  mileage,
  price,
  currency,
  condition,
}: {
  name: string;
  description: string;
  image?: string;
  url: string;
  brand: string;
  model: string;
  year: number;
  mileage?: string;
  price?: number;
  currency?: string;
  condition?: "NewCondition" | "UsedCondition";
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Car",
    name,
    description,
    image,
    url,
    brand: { "@type": "Brand", name: brand },
    model,
    vehicleModelDate: String(year),
    mileageFromOdometer: mileage
      ? { "@type": "QuantitativeValue", value: mileage, unitCode: "SMI" }
      : undefined,
    offers: price
      ? {
          "@type": "Offer",
          price: String(price),
          priceCurrency: currency || "USD",
          itemCondition: `https://schema.org/${condition || "UsedCondition"}`,
          availability: "https://schema.org/InStock",
        }
      : undefined,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
