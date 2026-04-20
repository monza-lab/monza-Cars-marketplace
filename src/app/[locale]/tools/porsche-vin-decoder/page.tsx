import type { Metadata } from "next";
import Link from "next/link";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FAQPageJsonLd,
  HowToJsonLd,
} from "@/components/seo/JsonLd";
import { VinDecoderClient } from "@/components/tools/VinDecoderClient";
import { getSiteUrl } from "@/lib/seo/siteUrl";

const BASE_URL = getSiteUrl();
const LOCALES = ["en", "es", "de", "ja"] as const;

const TITLES: Record<(typeof LOCALES)[number], string> = {
  en: "Porsche VIN Decoder — Free Tool to Identify Year, Plant, Generation | MonzaHaus",
  es: "Decodificador VIN Porsche — Herramienta Gratis para Año, Planta, Generación | MonzaHaus",
  de: "Porsche Fahrgestellnummer-Decoder — Baujahr, Werk, Generation | MonzaHaus",
  ja: "Porsche VINデコーダー — 年式・工場・世代を無料で識別 | MonzaHaus",
};

const DESCRIPTIONS: Record<(typeof LOCALES)[number], string> = {
  en: "Free Porsche VIN decoder. Enter any 17-character VIN and get model year, plant, generation hint, and serial number. Covers 911, Boxster, Cayman, Cayenne, Panamera, Macan (1981+).",
  es: "Decodificador VIN Porsche gratis. Ingresa cualquier VIN de 17 caracteres y obtén año, planta, pista de generación y número de serie. Cubre 911, Boxster, Cayman, Cayenne, Panamera, Macan (1981+).",
  de: "Kostenloser Porsche VIN-Decoder. Geben Sie eine 17-stellige Fahrgestellnummer ein und erhalten Sie Baujahr, Werk, Generationshinweis und Seriennummer. Abdeckung: 911, Boxster, Cayman, Cayenne, Panamera, Macan (ab 1981).",
  ja: "無料のPorsche VINデコーダー。17桁のVINを入力すると、モデル年、工場、世代のヒント、シリアル番号が得られます。911、Boxster、Cayman、Cayenne、Panamera、Macan (1981年以降) に対応。",
};

const FAQS: { question: string; answer: string }[] = [
  {
    question: "Where is the VIN located on a Porsche?",
    answer:
      "On modern Porsches (1981+), the VIN is stamped on a plate at the base of the windshield (driver's side), on a sticker inside the driver's door jamb, and stamped into the chassis in the luggage compartment. On 911s specifically, there is also a chassis-stamped number visible through a cutout in the front trunk. For a pre-purchase inspection, verify all three locations match.",
  },
  {
    question: "How many characters does a Porsche VIN have?",
    answer:
      "Porsches built from 1981 onwards use the 17-character ISO 3779 VIN format shared by all modern vehicles. Pre-1981 Porsches (early 911s, 356, etc.) use shorter chassis numbers specific to each model line — those cannot be decoded with a modern VIN tool.",
  },
  {
    question: "What does WP0 mean in a Porsche VIN?",
    answer:
      "WP0 is the World Manufacturer Identifier (WMI) for Porsche AG's Stuttgart-Zuffenhausen production — the 911, Boxster, Cayman, 928, 944, 968. The WMI WP1 is used for Leipzig-produced Porsches: Cayenne, Macan, Panamera, and Taycan. If a car advertised as a Porsche does not start with WP0 or WP1, it should be treated with suspicion.",
  },
  {
    question: "Why does my Porsche VIN model year code appear twice?",
    answer:
      "The ISO VIN standard uses 30 characters for model year encoding and cycles every 30 years. Letter 'A' covers both 1980 and 2010; 'B' covers 1981 and 2011; and so on. When a VIN letter is ambiguous, use the body code (positions 4–8) to disambiguate — a WP0ZZZ96 body code only existed during 1989–1994, so an 'N' year code on that VIN is 1992.",
  },
  {
    question: "Does this decoder tell me if the car is matching-numbers?",
    answer:
      "No. The decoder extracts structural VIN data (year, plant, serial, generation hint). It cannot confirm matching-numbers status (whether the engine, transmission, and body originally left the factory together). For that you need the Porsche Certificate of Authenticity (COA) from Porsche Classic — it's the only definitive source.",
  },
  {
    question: "What is a Porsche Certificate of Authenticity (COA)?",
    answer:
      "The COA is an official document issued by Porsche Classic confirming the exact specification of a specific Porsche when it left the factory: engine number, transmission number, paint code, option codes, delivery market, and more. It costs roughly $150–$200 to order from Porsche. A collector Porsche without a COA is harder to sell and to authenticate; any seller unwilling to provide one should be treated with skepticism.",
  },
  {
    question: "Can I decode a pre-1981 Porsche chassis number here?",
    answer:
      "Not with this tool. Pre-1981 Porsches (356, early 911, 914, 924 early production) use shorter chassis-number formats specific to each model. For those, Porsche Classic's COA service covers the entire production history and is the authoritative source.",
  },
  {
    question: "What is the plant code on a Porsche VIN?",
    answer:
      "Position 11 of the VIN indicates the factory. 'S' is Stuttgart-Zuffenhausen (911s and sports cars). 'L' is Leipzig (Cayenne, Panamera, Macan, Taycan). 'U' is Uusikaupunki, Finland — Valmet built early 986 Boxsters and some 987 Caymans there under contract. Knowing the plant helps contextualize some options (Leipzig produced cars in specific years) and sometimes corresponds to sub-variant build slots.",
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
  const url = `${BASE_URL}/${loc}/tools/porsche-vin-decoder`;

  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = `${BASE_URL}/${l}/tools/porsche-vin-decoder`;
  languages["x-default"] = `${BASE_URL}/en/tools/porsche-vin-decoder`;

  return {
    title,
    description,
    keywords: [
      "Porsche VIN decoder",
      "Porsche VIN lookup",
      "decode Porsche VIN",
      "Porsche Fahrgestellnummer",
      "Porsche chassis number",
      "Porsche VIN year",
      "911 VIN decoder",
      "964 VIN",
      "993 VIN",
      "Porsche authentication",
    ],
    alternates: { canonical: url, languages },
    openGraph: { title, description, url, type: "website", siteName: "MonzaHaus" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PorscheVinDecoderPage({ params }: PageProps) {
  const { locale } = await params;
  const loc = (LOCALES.includes(locale as (typeof LOCALES)[number])
    ? locale
    : "en") as (typeof LOCALES)[number];

  const url = `${BASE_URL}/${loc}/tools/porsche-vin-decoder`;

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
        name="How to decode a Porsche VIN"
        description="Step-by-step guide to interpreting every position in a modern Porsche VIN (1981+)."
        totalTimeISO="PT2M"
        steps={[
          {
            name: "Locate your 17-character Porsche VIN",
            text: "Find the VIN at the base of the windshield (driver's side), inside the driver's door jamb, or stamped into the front luggage compartment. Modern Porsches (1981+) always use a 17-character VIN.",
          },
          {
            name: "Verify the first three characters (WMI)",
            text: "WP0 indicates a Stuttgart-built Porsche (911, Boxster, Cayman). WP1 indicates Leipzig-built (Cayenne, Panamera, Macan, Taycan). If the WMI is not WP0 or WP1, the vehicle is not a Porsche.",
          },
          {
            name: "Check the model year at position 10",
            text: "Position 10 encodes the model year. Letters cycle every 30 years (A=1980 or 2010, B=1981 or 2011, etc.). Cross-check against the body code at positions 4-8 to disambiguate.",
          },
          {
            name: "Identify the plant at position 11",
            text: "S = Stuttgart, L = Leipzig, U = Uusikaupunki (Finland). This helps validate production context and spot inconsistencies.",
          },
          {
            name: "Cross-reference the body code (positions 4-8) with known generation patterns",
            text: "WP0ZZZ96 = 964 (1989-1994), WP0ZZZ99 = 993/991/992 (disambiguate by year), WP0ZZZ98 = 996/997/Boxster/Cayman (check year). Use the MonzaHaus decoder for automatic pattern matching.",
          },
          {
            name: "For collector purchases, always order a Porsche Certificate of Authenticity (COA)",
            text: "The COA from Porsche Classic is the only authoritative source for matching-numbers verification, original paint code, and factory options. Never close on a collector Porsche without one.",
            url: "https://classic.porsche.com",
          },
        ]}
      />
      <FAQPageJsonLd questions={FAQS} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: `${BASE_URL}/${loc}` },
          { name: "Tools", url: `${BASE_URL}/${loc}/tools` },
          { name: "Porsche VIN Decoder", url },
        ]}
      />

      <div className="min-h-screen bg-black text-zinc-100">
        <div className="mx-auto max-w-4xl px-6 py-12 space-y-10">
          <header className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-500">
              Free Tool · MonzaHaus
            </p>
            <h1 className="text-4xl md:text-5xl font-serif leading-tight">
              Porsche VIN Decoder
            </h1>
            <p className="text-lg text-zinc-400 max-w-3xl">
              Paste any 17-character Porsche VIN to extract model year, plant,
              generation, and serial number. Covers 1981+ production (911, Boxster,
              Cayman, Cayenne, Panamera, Macan, Taycan).
            </p>
          </header>

          <section>
            <VinDecoderClient />
          </section>

          <section className="prose prose-invert max-w-none text-zinc-300">
            <h2 className="text-2xl font-serif">How Porsche VINs are structured</h2>
            <p>
              Modern Porsches (1981+) use the 17-character VIN format standardized by
              ISO 3779. Each position encodes specific information: the first three
              characters identify the manufacturer (WP0 for Porsche AG Stuttgart,
              WP1 for Leipzig), positions 4–8 encode body and engine variant,
              position 9 is a check digit, position 10 is the model year, position
              11 is the assembly plant, and positions 12–17 are the unique serial
              number.
            </p>
            <p>
              Pre-1981 Porsches — 356, early 911, early 912, 914, and early 924
              production — use shorter chassis-number formats that predate the ISO
              standard. Those cannot be decoded with a modern VIN tool. For those
              vehicles, the Porsche Classic Certificate of Authenticity (COA) is the
              authoritative reference.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">Frequently asked questions</h2>
            <div className="space-y-4">
              {FAQS.map((faq) => (
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
            Looking to understand what a specific VIN is actually worth? See our{" "}
            <Link href={`/${loc}/indices`} className="text-amber-400 hover:underline">
              MonzaHaus Index
            </Link>{" "}
            for current market values, or the{" "}
            <Link
              href={`/${loc}/models/porsche/964`}
              className="text-amber-400 hover:underline"
            >
              model guides
            </Link>{" "}
            for generation-specific buyer context.
          </section>
        </div>
      </div>
    </>
  );
}
