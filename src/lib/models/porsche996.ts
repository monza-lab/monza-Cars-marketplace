import type { PorscheModelPage } from "./types";

export const porsche996: PorscheModelPage = {
  slug: "996",
  shortName: "996",
  fullName: "Porsche 911 (996)",
  tagline: "The first water-cooled 911 — the generation the market is learning to love.",
  indexSlug: "water-cooled-911",
  intro: [
    "The 996 was the most consequential 911 since the original — it ended 34 years of air-cooling, introduced a clean-sheet chassis, and moved Porsche from boutique engineering house to volume sports-car manufacturer. Launched in 1997 (model year 1998 in the US) and produced through 2005, it shared its headlights, interior architecture, and front structure with the contemporary Boxster to unlock the economies of scale that ultimately saved the company.",
    "For years, enthusiasts punished the 996 for those same decisions. The 'fried-egg' headlights, the Boxster-shared dash, and above all the intermediate shaft (IMS) bearing controversy pushed values to historic lows — clean Carreras traded under $20k for much of the 2010s. The market has since bifurcated sharply. Base Carreras remain the cheapest way into a modern 911, but 996 Turbo, Turbo S, GT3, and GT3 RS variants — all built on the Mezger racing engine and therefore untouched by IMS risk — have appreciated into six-figure collector territory.",
    "Understanding the 996 means understanding two cars: the mass-market water-cooled Carrera that normalized the 911, and the low-volume Mezger-powered halo cars that now sit among the most desirable modern Porsches ever built.",
  ],
  specs: {
    yearRange: "1998–2005",
    production: "≈175,000 units (all variants)",
    engine: "3.4L flat-six (M96) 1998–2001; 3.6L flat-six (M96) 2002–2005, water-cooled",
    power: "296 hp (3.4 Carrera) — 316 hp (3.6 Carrera); up to 444 hp (Turbo S) and 475 hp (GT2)",
    transmission: "6-speed manual (G96), 5-speed Tiptronic S optional",
    zeroToSixty: "5.0s (Carrera) — 3.8s (Turbo S)",
    topSpeed: "174 mph (Carrera) — 192 mph (GT2)",
    curbWeight: "≈2,910 lb (Carrera coupe)",
  },
  variants: [
    { name: "Carrera", yearRange: "1998–2005", note: "RWD base coupe and cabriolet. 3.4L through 2001, 3.6L from 2002. The entry point to water-cooled 911 ownership." },
    { name: "Carrera 4", yearRange: "1999–2005", note: "AWD variant. Slight weight penalty; trades at modest discount to Carrera 2." },
    { name: "Carrera 4S", yearRange: "2002–2005", note: "Widebody Turbo-look on AWD Carrera platform. Collector appetite for the wider stance has firmed values." },
    { name: "Targa", yearRange: "2002–2005", note: "Sliding glass roof over narrow body. Lowest-volume Carrera variant; niche collector demand." },
    { name: "Turbo", yearRange: "2001–2005", note: "Twin-turbocharged 3.6L Mezger (M96/70) — 415 hp, AWD. Not affected by IMS. Entry into the blue-chip 996." },
    { name: "Turbo S", yearRange: "2005", note: "444 hp, X50 package standard, ceramic brakes optional. ≈1,600 units. Values well into six figures." },
    { name: "GT2", yearRange: "2002–2005", note: "RWD twin-turbo Mezger — 456 hp rising to 475 hp. ≈1,287 units. Analog, no stability control." },
    { name: "GT3", yearRange: "1999–2005", note: "Naturally aspirated 3.6L Mezger (M96/76). Mk1 Euro-only (1999–2001). Mk2 (2003–2005) US-legal. No IMS concern." },
    { name: "GT3 RS", yearRange: "2004", note: "Euro-only homologation special, ≈682 units. Apex 996 collector car; blue-chip." },
  ],
  faqs: [
    {
      question: "Is the Porsche 996 IMS bearing problem really that bad?",
      answer:
        "The intermediate shaft bearing failure affected a minority of non-turbo, non-GT M96 engines built from 1998 through 2005, but when it fails the engine is typically destroyed. Independent studies have placed the failure rate in the ~8–10% range across the population. Retrofit kits (LN Engineering IMS Solution and others) eliminate the risk going forward, and many cars have already been upgraded — a documented retrofit is a meaningful value add on inspection.",
    },
    {
      question: "Which 996 engines are NOT affected by IMS failure?",
      answer:
        "All 996 Turbo, Turbo S, GT2, GT3, and GT3 RS models use the Mezger engine (M96/70 and M96/76 families), which is a dry-sump racing-derived architecture with no intermediate shaft bearing in the failure-prone configuration. The IMS issue is confined to the M96 road-car engine used in Carrera, Carrera 4, Carrera 4S, and Targa.",
    },
    {
      question: "How much does a Porsche 996 cost in 2026?",
      answer:
        "Clean Carrera coupes typically trade $25k–$45k, with Carrera 4S widebody running $40k–$65k. 996 Turbo coupes sit $60k–$110k depending on manual vs Tiptronic and X50 package. Turbo S has crossed $150k+. GT3 Mk1 trades $100k–$160k, GT3 Mk2 $120k–$200k, and GT3 RS $400k–$700k+. Check the MonzaHaus Water-Cooled 911 Index for current medians.",
    },
    {
      question: "What is the best 996 to buy for collector value?",
      answer:
        "For pure appreciation potential, the 996 GT3 RS and Turbo S sit at the top — both are rare, Mezger-engined, and already blue-chip. The 996 Turbo manual with X50 package is the most accessible Mezger 911 and has shown steady gains. Among Carreras, the 2002–2005 Carrera 4S widebody has the strongest market support.",
    },
    {
      question: "What are common problems on a 996 Carrera?",
      answer:
        "Beyond IMS bearing, the Carrera's M96 engine is known for rear main seal (RMS) leaks, plastic coolant pipes that can fail and dump coolant at the engine (aluminum replacement is a common preventive fix), cracked cylinder heads on early 3.4L engines, and AOS (air-oil separator) failures. None are universal, and a well-sorted example with documented repairs can be highly reliable.",
    },
    {
      question: "Is the 996 Turbo a good investment?",
      answer:
        "The 996 Turbo has appreciated steadily since ~2018. It offers Mezger-engine robustness, AWD traction, and supercar performance at a fraction of contemporary GT3 money. Manual-transmission examples with the X50 package have shown the strongest gains. Tiptronic cars and cosmetically tired examples trade at a meaningful discount.",
    },
    {
      question: "Should I buy a 996 or a 997?",
      answer:
        "The 997 (2005–2012) is the 996's direct successor, sharing platform DNA but with revised styling, better interior, and — on 997.2 from 2009 — direct injection that eliminates IMS concerns on Carreras. The 997 commands a meaningful premium for equivalent variants. The 996 is the value play; the 997 is the more refined collector asset. For Mezger Turbo and GT cars, both generations are desirable and the choice is largely cosmetic preference.",
    },
    {
      question: "How many 996 GT3 RS were built?",
      answer:
        "Approximately 682 units of the 996 GT3 RS were produced in 2004 for the European market (it was not sold new in the US). Combined with its Mezger engine, homologation pedigree, and the fact that it launched the modern RS lineage, it is one of the most sought-after modern Porsches and trades firmly in six-figure territory, with top examples clearing half a million.",
    },
    {
      question: "Can I daily-drive a Porsche 996?",
      answer:
        "Yes. The 996 was designed as a usable modern 911 with air conditioning, modern ergonomics, and genuinely efficient touring manners. Owners regularly cover 8,000–15,000 miles per year. Preventive maintenance — IMS retrofit (where applicable), coolant pipe update, RMS check — is strongly recommended before high-mileage use.",
    },
    {
      question: "What should I look for in a 996 pre-purchase inspection?",
      answer:
        "Borescope inspection for cylinder scoring, oil analysis for metal content (IMS early warning), documented IMS retrofit status, coolant pipe condition, RMS leak severity, AOS function, suspension bushing wear, and complete service history with receipts. On Turbo and GT cars, confirm Mezger-specific service intervals and track history. A Porsche-specialist PPI is essential.",
    },
  ],
  buyerConsiderations: [
    "IMS retrofit documentation on Carrera variants is the single biggest value and risk lever — a documented LN IMS Solution or equivalent adds $3–6k of buyer confidence.",
    "Mezger-engined cars (Turbo, Turbo S, GT2, GT3, GT3 RS) are a fundamentally different asset class from Carreras and should be evaluated on their own market curves.",
    "Manual transmission commands a 15–25% premium over Tiptronic across all variants; the gap widens on Turbo and GT cars.",
    "Pre-2002 cars with the 3.4L engine have a slightly higher incidence of cylinder head issues; 2002+ 3.6L is the preferred Carrera for long-term ownership.",
    "Documented service history, original paint, and low ownership count matter disproportionately on 996 because the market has historically undervalued these cars and poorly-kept examples are common.",
    "Budget $4–7k post-purchase for deferred maintenance on a Carrera; more if the IMS and coolant pipes have not been addressed.",
  ],
  thesis:
    "The 996 market has split cleanly in two. Base Carreras have completed most of their recovery from 2010s lows and now trade in a stable band; further appreciation is likely modest and dependent on broad water-cooled 911 demand. The Mezger-engined halo cars — Turbo S, GT3, and especially GT3 RS — remain in an active appreciation cycle driven by genuine scarcity, racing pedigree, and immunity from the IMS narrative. The 996 is no longer the cheap 911; it is two very different cars sharing a body.",
  keywords: [
    "Porsche 996",
    "Porsche 911 996",
    "996 Carrera",
    "996 Turbo",
    "996 GT3",
    "996 GT3 RS",
    "996 Turbo S",
    "IMS bearing",
    "water-cooled Porsche",
    "996 buyer's guide",
    "996 market value",
    "996 investment",
  ],
};
