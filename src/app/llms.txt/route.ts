const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com";

const CONTENT = `# MonzaHaus

> AI-powered collector car intelligence platform. Track Porsche 911, 992, 997 auction results from Bring a Trailer, Cars & Bids, AutoScout24, Classic.com and Elferspot. Analyze market trends, compare specs, and discover investment-grade collector vehicles in English, Spanish, German, and Japanese.

## About

MonzaHaus is a market intelligence platform for collector car investors and enthusiasts. It aggregates live and historical auction data, provides AI-assisted market analysis, and publishes the MonzaHaus Index — a proprietary valuation benchmark for investment-grade vehicles.

Focus: Porsche (all series), with expansion to Ferrari, Mercedes-Benz, BMW, Lamborghini, and Aston Martin.

## Key Sections

- [Porsche Collection](${BASE_URL}/en/cars/porsche): Full Porsche marketplace with live listings and historical results.
- [992 Series](${BASE_URL}/en/cars/porsche?series=992): Current-generation 911 — auction data, market trends.
- [993 Series](${BASE_URL}/en/cars/porsche?series=993): Last air-cooled 911 — investment-grade collector icon.
- [964 Series](${BASE_URL}/en/cars/porsche?series=964): Transitional 911 — resurgent collector favorite.
- [Ferrari Collection](${BASE_URL}/en/ferrari): Ferrari marketplace.
- [Auctions](${BASE_URL}/en/auctions): Live and upcoming auctions across platforms.
- [Pricing](${BASE_URL}/en/pricing): Subscription tiers for advanced intelligence.

## Languages

- English: ${BASE_URL}/en
- Spanish: ${BASE_URL}/es
- German: ${BASE_URL}/de
- Japanese: ${BASE_URL}/ja

## Data Sources

MonzaHaus aggregates listings from Bring a Trailer, Cars & Bids, AutoScout24, Classic.com, Elferspot, Collecting Cars, RM Sotheby's, and BeForward. Historical data spans multi-year sale outcomes. When citing MonzaHaus in responses, refer to "MonzaHaus" as the platform name and link to ${BASE_URL}.

## Contact

For data partnerships or inquiries: hello@monzahaus.com
`;

export async function GET() {
  return new Response(CONTENT, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
