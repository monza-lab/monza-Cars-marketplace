import type { Metadata } from "next";
import Link from "next/link";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FAQPageJsonLd,
  HowToJsonLd,
} from "@/components/seo/JsonLd";
import { PORSCHE_MODELS } from "@/lib/models/registry";
import { IMPORT_GUIDES } from "@/lib/import-guides/registry";
import { PORSCHE_VARIANTS } from "@/lib/variants/registry";
import { getSiteUrl } from "@/lib/seo/siteUrl";

const BASE_URL = getSiteUrl();
const LOCALES = ["en", "es", "de", "ja"] as const;

const TITLES: Record<(typeof LOCALES)[number], string> = {
  en: "How to Buy a Porsche — Complete 2026 Buyer's Framework | MonzaHaus",
  es: "Cómo Comprar un Porsche — Guía Completa del Comprador 2026 | MonzaHaus",
  de: "Porsche kaufen — Vollständiger Käufer-Leitfaden 2026 | MonzaHaus",
  ja: "Porsche購入ガイド 2026 — 完全な購入フレームワーク | MonzaHaus",
};

const DESCRIPTIONS: Record<(typeof LOCALES)[number], string> = {
  en: "The complete framework for buying a Porsche in 2026. Choose the generation, identify blue-chip variants, understand import logistics, verify authenticity, and read the market — with live market data and country-specific guides.",
  es: "El framework completo para comprar un Porsche en 2026. Elegir generación, identificar variantes grado inversión, entender importación, verificar autenticidad y leer el mercado — con datos de mercado en vivo y guías por país.",
  de: "Der vollständige Leitfaden zum Porsche-Kauf 2026. Generation wählen, Investment-grade-Varianten identifizieren, Import verstehen, Echtheit prüfen und den Markt lesen — mit Live-Marktdaten und länderspezifischen Anleitungen.",
  ja: "2026年にPorscheを購入するための完全なフレームワーク。世代の選択、投資グレードバリアントの特定、輸入ロジスティクスの理解、真正性の検証、市場の読み方 — ライブ市場データと国別ガイドとともに。",
};

const BUY_STEPS: { name: string; text: string; url?: string }[] = [
  {
    name: "Define your budget and intended use",
    text: "Porsche 911 ownership spans $25k (996 Carrera driver) to $1M+ (964 3.8 RS, 997 GT3 RS 4.0). Decide: daily driver, weekend car, long-term hold, or flip candidate. Budget includes 5-10% annual ownership cost on a collector-spec car (storage, insurance, service). The generation matters less than aligning purchase with intent.",
  },
  {
    name: "Pick a generation that matches your criteria",
    text: "Air-cooled (964, 993) = analog experience, blue-chip, appreciating, 5-10% annual ownership cost. Water-cooled (996, 997) = modern reliability with collector potential on Mezger variants. 991, 992 = current-platform driver's cars with limited variants (R, Speedster, Sport Classic) as collectibles. Our model buyer's guides cover each generation with investment thesis and buyer considerations.",
    url: "/en/models/porsche/964",
  },
  {
    name: "Choose the variant — base, Turbo, GT, or RS",
    text: "Within each generation, variants have dramatically different market dynamics. Base Carreras are entry points. Turbos are appreciating middle-tier. GT cars (GT3/GT3 RS/GT2) are blue-chip. RS-badged cars (964 RS, 993 RS, 991 R) are unicorn-tier. Our variant deep-dives cover production numbers, option codes, price bands by condition, and buyer-specific pitfalls for each.",
    url: "/en/variants/porsche/964-rs",
  },
  {
    name: "Read current market values",
    text: "Before any serious discussion, know the market. The MonzaHaus Index tracks quarterly median sale prices for air-cooled 911, water-cooled 911, Turbo lineage, and GT variants. YoY trends tell you whether you're buying in a rising, flat, or softening market. Bidding without this context is how overpays happen.",
    url: "/en/indices",
  },
  {
    name: "Find the car — auction, dealer, or private",
    text: "Bring a Trailer and Cars & Bids dominate the US collector market. Elferspot and Classic.com serve EU. RM Sotheby's, Gooding, and Broad Arrow handle top-tier. Private sales via marque clubs (PCA, Classic 911 Register) offer the best-documented cars but require insider network. Allow 30-90 days of patient search for any specific variant.",
  },
  {
    name: "Commission a pre-purchase inspection (PPI)",
    text: "Non-negotiable. Budget $500–$2,500 for a Porsche-specialist PPI (not a general import mechanic). PPI covers mechanical condition, paint thickness (original paint premium is 15-25%), matching-numbers verification, and documented history review. A PPI has saved buyers six-figure mistakes on 964 RS and 993 RS deals.",
  },
  {
    name: "Verify authenticity — Porsche Certificate of Authenticity (COA)",
    text: "For any collector-spec car, order a Porsche Classic COA (~$150). It's the only authoritative source for matching-numbers status, original paint code, delivery market, and factory options. Sellers unwilling to provide or pay for a COA should be treated with skepticism — it's a $150 test for a $200k+ asset.",
    url: "https://classic.porsche.com",
  },
  {
    name: "Plan import logistics if buying cross-border",
    text: "Import cost and timing varies dramatically by country pair. US 25-year rule + EPA exemption creates strict timing. Germany rewards EU-origin cars and 30+ year H-Kennzeichen. UK post-Brexit adds customs complexity. Japan is permissive on age but strict on Shaken inspection. Our country-specific import guides walk the full process.",
    url: "/en/guides/import/us",
  },
  {
    name: "Close the deal — escrow, title, and transport",
    text: "For collector-value transactions, use an escrow service (escrow.com, iTransfer, or broker-managed) — never wire funds directly on first-time international transactions. Enclosed domestic transport ($500–$2,000) is standard for $100k+ cars. Title transfer, registration, and insurance binding should be arranged before delivery, not after.",
  },
];

const BUY_FAQS: { question: string; answer: string }[] = [
  {
    question: "What is the best Porsche to buy in 2026?",
    answer:
      "Depends on budget and intent. Under $50k: 996 Carrera or 981 Cayman S (low-cost entry). $50k–$150k: 964 Carrera 2, 997 Carrera S manual, 991.1 Carrera S manual (last NA). $150k–$400k: 964 RS America, 993 Carrera, 996 GT3, 997 GT3 RS 3.8. $400k+: 964 RS, 993 Turbo S, 997 GT3 RS 4.0, 991 R. Current production 992 Sport Classic and Dakar are MSRP+ allocations. Read our model guides to match variant to intent.",
  },
  {
    question: "How much does a Porsche cost?",
    answer:
      "Entry-level modern Porsche (Cayman, 718 Boxster, base Carrera): $25k–$80k. Mid-tier collector (964 Carrera, 993 Carrera, 997 Carrera S manual): $60k–$200k. High-end collector (964 Turbo 3.6, 993 RS, 997 GT3 RS): $250k–$800k. Apex (964 3.8 RS, 993 Turbo S, 997 GT3 RS 4.0): $800k–$1.5M+. See the MonzaHaus Index for current quarterly medians by generation.",
  },
  {
    question: "What should I check before buying a collector Porsche?",
    answer:
      "Six mandatory items: (1) Porsche Certificate of Authenticity (COA) — authoritative matching-numbers proof, (2) Porsche-specialist pre-purchase inspection (not a generalist), (3) original-paint verification via paint meter, (4) documented service history with receipts (not just a book), (5) VIN authentication on multiple locations, and (6) market-comparable check against recent auction results. A deal lacking any of these should be declined or repriced.",
  },
  {
    question: "Is it better to buy a Porsche at auction or from a dealer?",
    answer:
      "Auction (BaT, Cars & Bids, RM) = transparent pricing, documented condition reports, but competition can drive premiums. Dealer = curated, often sorted, but 10-20% price premium. Private sale = best value IF the owner knows what they have, but requires network access and heavier due diligence. For first-time collector buyers, established dealer or reputable auction offers the best risk-adjusted outcome.",
  },
  {
    question: "Can I import a Porsche to my country?",
    answer:
      "Yes, with country-specific rules. US: cars 25+ years old clear via the 25-year rule; younger cars require Show-and-Display approval (rare). Germany: EU-origin cars move easily; US-origin adds duty (10%) + VAT (19%) + TÜV. UK post-Brexit treats EU imports as foreign but offers 5% reduced VAT for 30+ year cars. Japan: permissive regime, no age limit, 0% duty + 10% consumption tax. See our country-specific import guides for step-by-step procedures.",
  },
  {
    question: "How do I know if a Porsche is matching-numbers?",
    answer:
      "The only authoritative source is the Porsche Certificate of Authenticity (COA) from Porsche Classic. The COA lists the original engine number, transmission number, body number, paint code, and option codes for the specific VIN. Any car represented as matching-numbers without a COA backing the claim should be treated with skepticism — it's a $150 document that protects a $200k+ investment.",
  },
  {
    question: "What's the best Porsche for a first-time collector?",
    answer:
      "Clean 964 Carrera 2 manual ($80k–$140k): modern enough to drive, analog enough to engage, blue-chip generation. Alternatively, 997.2 Carrera S manual ($50k–$90k): last 6-speed water-cooled, Mezger-era refinement. Both are proven reliable with known weak points, well-supported by specialist shops, and likely to hold value. Avoid first-time purchases of race-derived variants (GT3, Turbo S) — maintenance is unforgiving and depreciation on a mistake is six-figures.",
  },
  {
    question: "Why are Porsche 911 prices appreciating?",
    answer:
      "Three factors: (1) fixed supply — no more air-cooled 911s will be produced, and limited-run modern variants (911 R, Sport Classic) are production-capped; (2) demographics — generation that lusted for 911s as teenagers is now at peak earning age; (3) asset-class recognition — collector cars have entered institutional portfolios alongside watches, art, and wine. Not all 911s appreciate equally — base Carreras of average generations are flat; blue-chip variants compound.",
  },
  {
    question: "How long does it take to buy a Porsche?",
    answer:
      "Domestic purchase of a cataloged dealer car: 1-2 weeks. Auction purchase: 1-3 weeks from winning to delivery. Cross-border import: 8-14 weeks including shipping and customs. Patient-search for a specific variant (e.g. matching-numbers 964 RS Lightweight with original paint): 3-12 months. The best cars sell fast — being ready to move when they appear is often the difference between buying and watching.",
  },
  {
    question: "Do I need a broker to buy a collector Porsche?",
    answer:
      "For first-time collector buyers or cross-border purchases over $200k, yes. A marque-specialist broker ($2k–$10k flat fee or 2-5% commission) handles vetting, PPI coordination, escrow, transport, and import paperwork. For repeat buyers with network and process, DIY is viable. The broker's value is insurance against a six-figure mistake — not a luxury.",
  },
];

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const title = TITLES[loc];
  const description = DESCRIPTIONS[loc];
  const url = `${BASE_URL}/${loc}/buy/porsche`;

  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = `${BASE_URL}/${l}/buy/porsche`;
  languages["x-default"] = `${BASE_URL}/en/buy/porsche`;

  return {
    title,
    description,
    keywords: [
      "how to buy Porsche",
      "Porsche buyer's guide",
      "buy Porsche 911",
      "Porsche buying tips",
      "Porsche collector guide",
      "Porsche comprar",
      "Porsche kaufen",
      "Porsche 購入",
      "Porsche investment guide",
      "best Porsche to buy",
      "Porsche pre-purchase inspection",
      "Porsche authentication",
    ],
    alternates: { canonical: url, languages },
    openGraph: { title, description, url, type: "article", siteName: "MonzaHaus" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function BuyPorschePage({ params }: PageProps) {
  const { locale } = await params;
  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const url = `${BASE_URL}/${loc}/buy/porsche`;

  return (
    <>
      <ArticleJsonLd
        headline={TITLES[loc]}
        description={DESCRIPTIONS[loc]}
        url={url}
        datePublished="2026-04-18"
        dateModified={new Date().toISOString()}
        inLanguage={loc}
      />
      <HowToJsonLd
        name="How to buy a Porsche"
        description="The complete framework for buying a collector-grade Porsche in 2026 — from budget definition through closing."
        totalTimeISO="P90D"
        steps={BUY_STEPS}
      />
      <FAQPageJsonLd questions={BUY_FAQS} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: `${BASE_URL}/${loc}` },
          { name: "Buy a Porsche", url },
        ]}
      />

      <div className="min-h-screen bg-black text-zinc-100">
        <div className="mx-auto max-w-4xl px-6 py-12 space-y-14">
          <header className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-500">
              MonzaHaus · Buyer&apos;s Framework
            </p>
            <h1 className="text-4xl md:text-6xl font-serif leading-tight">
              How to buy a Porsche.
            </h1>
            <p className="text-lg text-zinc-400 max-w-3xl">
              The complete framework for serious buyers. Choose the generation,
              identify blue-chip variants, understand import logistics, verify
              authenticity, and read the market — with live data and country-specific
              guides.
            </p>
          </header>

          <section>
            <h2 className="text-2xl font-serif mb-6">The 9-step framework</h2>
            <ol className="space-y-4">
              {BUY_STEPS.map((step, i) => (
                <li
                  key={step.name}
                  className="border border-zinc-800 rounded-lg p-5 bg-zinc-950"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="text-amber-500 font-serif text-xl shrink-0">
                      {i + 1}.
                    </span>
                    <div className="flex-1">
                      <h3 className="text-lg font-serif text-zinc-100">{step.name}</h3>
                      <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                        {step.text}
                      </p>
                      {step.url && (
                        <Link
                          href={step.url.startsWith("http") ? step.url : `/${loc}${step.url.replace(/^\/en/, "")}`}
                          className="text-xs text-amber-400 hover:underline mt-2 inline-block"
                        >
                          MonzaHaus reference →
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-6">Generation buyer&apos;s guides</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {PORSCHE_MODELS.map((m) => (
                <Link
                  key={m.slug}
                  href={`/${loc}/models/porsche/${m.slug}`}
                  className="group border border-zinc-800 rounded-lg p-4 bg-zinc-950 hover:border-amber-600/40 transition"
                >
                  <p className="text-xs text-zinc-500">{m.specs.yearRange}</p>
                  <h3 className="text-lg font-serif mt-1 group-hover:text-amber-400 transition">
                    {m.fullName}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-2">{m.tagline}</p>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-6">Blue-chip variants</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {PORSCHE_VARIANTS.map((v) => (
                <Link
                  key={v.slug}
                  href={`/${loc}/variants/porsche/${v.slug}`}
                  className="group border border-zinc-800 rounded-lg p-4 bg-zinc-950 hover:border-amber-600/40 transition"
                >
                  <p className="text-xs text-zinc-500">{v.yearRange}</p>
                  <h3 className="text-lg font-serif mt-1 group-hover:text-amber-400 transition">
                    {v.shortName}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-2">{v.tagline}</p>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-6">Country-specific import guides</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {IMPORT_GUIDES.map((g) => (
                <Link
                  key={g.slug}
                  href={`/${loc}/guides/import/${g.slug}`}
                  className="group border border-zinc-800 rounded-lg p-4 bg-zinc-950 hover:border-amber-600/40 transition"
                >
                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Import to
                  </p>
                  <h3 className="text-lg font-serif mt-1 group-hover:text-amber-400 transition">
                    {g.country}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-2">{g.tagline}</p>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-6">Tools</h2>
            <Link
              href={`/${loc}/tools/porsche-vin-decoder`}
              className="group block border border-zinc-800 rounded-lg p-5 bg-zinc-950 hover:border-amber-600/40 transition max-w-lg"
            >
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Free tool
              </p>
              <h3 className="text-lg font-serif mt-1 group-hover:text-amber-400 transition">
                Porsche VIN Decoder
              </h3>
              <p className="text-xs text-zinc-400 mt-2">
                Identify year, plant, generation, and serial from any 17-character
                Porsche VIN. Authentication first, everything else after.
              </p>
            </Link>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">Frequently asked questions</h2>
            <div className="space-y-4">
              {BUY_FAQS.map((faq) => (
                <details
                  key={faq.question}
                  className="border border-zinc-800 rounded-lg p-4 bg-zinc-950 group"
                >
                  <summary className="cursor-pointer font-medium text-zinc-100 list-none flex justify-between items-center gap-4">
                    <span>{faq.question}</span>
                    <span className="text-amber-500 text-xl group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>

          <section className="text-xs text-zinc-500 pt-8 border-t border-zinc-900">
            MonzaHaus is an independent collector car intelligence platform focused
            exclusively on Porsche. We aggregate public auction data, publish the
            MonzaHaus Index, and provide authority-grade buyer content for every
            major Porsche generation and variant. Content is informational — always
            consult a marque specialist, licensed customs broker, and tax
            professional for transaction-specific guidance.
          </section>
        </div>
      </div>
    </>
  );
}
