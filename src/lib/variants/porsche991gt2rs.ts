import type { PorscheVariantPage } from "./types";

export const porsche991gt2rs: PorscheVariantPage = {
  slug: "991-gt2-rs",
  shortName: "991 GT2 RS",
  fullName: "Porsche 911 (991.2) GT2 RS",
  parentModelSlug: "991",
  tagline: "The most powerful road 911 Porsche had ever built — 690 hp, Nordschleife record holder at launch.",
  intro: [
    "The 991 GT2 RS was announced at Goodwood in 2017 and produced for model years 2018 and 2019 as the performance apex of the 991 generation. It pairs a 3.8L twin-turbo flat-six producing 690 hp with a seven-speed PDK, a widebody 991.2 GT-chassis with comprehensive aero, and — for cars optioned with the Weissach Package — additional carbon and magnesium weight reduction. At launch it set the Nürburgring Nordschleife production-car record at 6:47.3.",
    "The engine is not a Mezger. The 991 GT2 RS uses a motorsport-developed version of Porsche's 9A1-derived direct-injected turbo flat-six, shared in architecture with the 991 Turbo but with unique turbochargers, intercooling (water spray on the intake), and internal hardware. It is the first GT2 RS of the post-Mezger era and represents the point where the GT2 lineage fully transitioned to modern turbo architecture.",
    "Total production across 2018 and 2019 model years, including the Manthey Racing 'MR' factory-partnership upgrade package delivered to select cars, is in the ≈1,000-unit range. Values have been volatile: cars traded below MSRP in 2020–2021, re-rated hard in 2022, and now sit in the $500k–$1M+ band with Weissach-package and MR-kit cars at the top. It is the dominant GT2 in collector conversations today.",
  ],
  yearRange: "2017–2019 (MY2018–2019)",
  production: "≈1,000 units globally across MY2018–2019; Weissach Package take rate estimated at 50–70%; MR upgrade applied to a subset post-delivery",
  significance: [
    "The 991 GT2 RS reset the benchmark for what a road-legal 911 could do. At 690 hp and sub-2.8 seconds 0–100 km/h it was, at launch, the most powerful production 911 ever built — a title it held until the 992 GT2 RS category was addressed differently. Its 6:47.3 Nordschleife time in 2017, and the subsequent 6:40.3 run by the Manthey-prepared MR variant in 2018, pushed the production-car lap-time conversation into genuine supercar territory.",
    "More structurally, the 991 GT2 RS is where the GT2 lineage shed its 'widowmaker' cultural reputation and became a technically dominant apex product. Earlier GT2s (993, 996, 997) were raw, manual-only, and priced below the contemporary GT3 RS. The 991 GT2 RS is PDK-only, electronically sophisticated, and priced above every other 991 at launch. It rewrote the category.",
  ],
  specs: [
    { label: "Engine", value: "3.8L twin-turbo flat-six — 9A1-derived motorsport variant (MDH.NA)" },
    { label: "Power", value: "690 hp @ 7,000 rpm" },
    { label: "Torque", value: "553 lb-ft @ 2,500–4,500 rpm" },
    { label: "Transmission", value: "7-speed PDK only (no manual)" },
    { label: "Drive", value: "Rear-wheel drive" },
    { label: "Weight", value: "≈1,470 kg (3,241 lb) standard; ≈1,430 kg with Weissach Package" },
    { label: "0–100 km/h (0–62 mph)", value: "2.8 s" },
    { label: "Top speed", value: "340 km/h (211 mph)" },
    { label: "Nürburgring Nordschleife", value: "6:47.3 (stock, 2017) / 6:40.3 (Manthey MR, 2018)" },
    { label: "Brakes", value: "PCCB ceramic standard" },
    { label: "Aero", value: "Massive rear wing, front hood air outlets, NACA ducts in carbon hood, underbody diffuser" },
  ],
  identifiers: [
    { label: "VIN pattern", value: "WP0AE2A96JS1XXXXX (US MY2018) / WP0AE2A99KS1XXXXX (US MY2019) — 991.2 GT2 RS chassis" },
    { label: "Engine code", value: "MDH.NA — unique to 991 GT2 RS; not the 991 Turbo S engine" },
    { label: "Body", value: "Widebody 991.2 GT panels, carbon hood with NACA ducts, carbon front fenders, fixed carbon rear wing with Gurney flap" },
    { label: "Interior", value: "Alcantara-trimmed cabin, GT2 RS-specific buckets (full carbon buckets with Weissach), RS-specific door pulls, build-plate with serial number" },
    { label: "Weissach identifier", value: "Magnesium wheels (visually lighter satin finish), carbon roof, carbon anti-roll bars (not visible), carbon shift paddles, Weissach Package plaque on dashboard" },
    { label: "MR identifier", value: "Manthey Racing serial plate, Manthey-specific aero parts (front splitter, dive planes, rear wing uprights), specific suspension tune — applied post-delivery at Manthey facility" },
  ],
  subVariants: [
    { name: "GT2 RS standard", yearRange: "2018–2019", note: "Base spec — still PCCB, carbon hood, full aero. The volume configuration; trades at a discount to Weissach." },
    { name: "Weissach Package", yearRange: "2018–2019", production: "Take rate ≈50–70%", note: "≈$31k factory option. Magnesium wheels, carbon roof, carbon anti-roll bars and coupling rods, titanium exhaust, Alcantara-heavy interior, Weissach plaque. Saves ≈40 kg. Commands a clear premium in the market." },
    { name: "Manthey Racing (MR) upgrade", yearRange: "2018–2019 cars, upgraded 2019+", note: "Factory-sanctioned Manthey aero, suspension and brake-cooling package applied post-delivery at Manthey in Meuspath. The MR car set the 6:40.3 Nürburgring record. Commands a meaningful premium when the Manthey paperwork is in order." },
  ],
  priceBands: [
    { label: "Driver-grade standard", range: "$400k–$550k", note: "Standard (non-Weissach), higher mileage (15k+ km), original paint, documented history" },
    { label: "Excellent standard", range: "$550k–$700k", note: "Low-mileage standard-spec cars with full books" },
    { label: "Weissach Package", range: "$650k–$900k", note: "Weissach-optioned cars across the condition spectrum; premium over standard is material and persistent" },
    { label: "Low-mileage Weissach / concours", range: "$900k–$1.2M", note: "Sub-5k km Weissach cars in concours condition" },
    { label: "Manthey Racing (MR)", range: "$900k–$1.4M+", note: "Genuine MR conversions with paperwork trade at a clear premium, especially MR-on-Weissach combinations" },
  ],
  faqs: [
    {
      question: "How many 991 GT2 RS were made?",
      answer:
        "Porsche has not released an official worldwide production figure. Specialist estimates, based on VIN analysis and factory communications, place total 991 GT2 RS production across MY2018 and MY2019 in the ≈1,000-unit range. The Weissach Package take rate is estimated at 50–70%. The Manthey Racing MR upgrade was applied to a subset of cars post-delivery and is not a separate production run — it is an engineering package retrofitted at Manthey's Meuspath facility.",
    },
    {
      question: "What's the difference between a 991 GT2 RS and a 997 GT2 RS?",
      answer:
        "The 997 GT2 RS (2010–2012, 500 units, 620 hp Mezger twin-turbo, 6-speed manual) is the last Mezger GT2 — raw, manual, scarcer, and collector-priced accordingly ($700k–$1.2M). The 991 GT2 RS (≈1,000 units, 690 hp 9A1-derived twin-turbo, PDK-only) is faster, more electronically sophisticated, and built in larger numbers. The 997 is the Mezger collector play; the 991 is the performance apex. They are different propositions and both currently sit in similar price territory for different reasons.",
    },
    {
      question: "What does the Weissach Package do, and is it worth it?",
      answer:
        "The Weissach Package (≈$31k option when new) adds magnesium wheels, carbon roof, carbon anti-roll bars and coupling rods, titanium exhaust, additional Alcantara trim, and a dashboard plaque. Weight saving is ≈40 kg. In market terms the Weissach premium over an equivalent standard car is typically $100k–$200k — materially more than the original option cost. For a car held long-term, Weissach has proven to be the better collector specification.",
    },
    {
      question: "What is the Manthey Racing (MR) version?",
      answer:
        "The Manthey Racing MR is a factory-sanctioned performance upgrade applied to already-delivered 991 GT2 RS cars at the Manthey Racing facility in Meuspath, Germany. It includes revised aero (front splitter, dive planes, rear wing components), a specific suspension setup, and brake-cooling improvements. A Manthey-prepared GT2 RS set the Nürburgring Nordschleife production-car record at 6:40.3 in 2018. Genuine MR cars carry a Manthey plaque and paperwork; value premium depends on documentation and whether the underlying car is Weissach.",
    },
    {
      question: "What was the 991 GT2 RS Nürburgring time and how does it compare?",
      answer:
        "In 2017, a standard 991 GT2 RS set a 6:47.3 Nordschleife time, then the outright production-car record. In 2018, the Manthey MR-prepared GT2 RS ran 6:40.3. Both times have since been beaten by other cars, but the GT2 RS's launch-moment record and subsequent MR run cemented its status as the defining fast 991. The record context is part of why values re-rated hard in 2022 despite broader market conditions.",
    },
    {
      question: "911 Turbo S versus 991 GT2 RS — what's the real difference?",
      answer:
        "The 991 Turbo S (580 hp later 650 hp, all-wheel drive, heavier, broader production) is a grand-touring performance car. The 991 GT2 RS is a GT-division product: rear-wheel drive, ≈100 kg lighter, 690 hp, harder suspension, fixed aero, PCCB standard, full carbon hood and wing, Nürburgring-tuned. At the track the delta is not close. At the collector level they occupy different categories — Turbo S is a usable supercar; GT2 RS is a limited-run GT apex product.",
    },
    {
      question: "Why is the 991 GT2 RS PDK-only?",
      answer:
        "Porsche took the position that at 690 hp and sub-2.8-second 0–100 km/h, PDK was the only transmission capable of delivering the performance envelope reliably and consistently. A manual would have added weight, cost launch performance, and — given the torque curve — required a significantly heavier-duty driveline. From the 991.2 GT2 RS and 991.2 GT3 RS onward, PDK-only has been the standard for Porsche's highest-performance GT cars.",
    },
    {
      question: "Why does the 991 GT2 RS dominate the GT2 lineage conversation?",
      answer:
        "Power, scarcity and record. The 991 GT2 RS produces more power than the 993, 996, 997 and 997 RS GT2s combined in percentage terms, set the production-car Nordschleife record at launch, and was built in ≈1,000 units across a two-year window. Earlier GT2s were revered but niche; the 991 GT2 RS was a cultural moment. It is now the reference point against which every other GT2 is measured — and against which the 992 GT2 RS category will be judged when it arrives.",
    },
    {
      question: "Will the 991 GT2 RS appreciate from here?",
      answer:
        "Uncertain, and honest analysis requires acknowledging that. The car traded below MSRP in 2020–2021, then re-rated sharply in 2022 to the $900k–$1.3M range for Weissach cars, and has since softened modestly. The long-term structural case — Nordschleife record, ≈1,000 units, apex 991, closing chapter of naturally-aspirated-era GT development — supports value preservation. But the near-term case depends on the 992 GT2 RS arrival, broader supercar sentiment, and rates. A conservative view is flat-to-modestly-up over 3–5 years; a bullish view is a further re-rating if 992 GT2 RS does not materialize or arrives with characteristics that favor the 991 in retrospect.",
    },
    {
      question: "What should I check on a 991 GT2 RS pre-purchase inspection?",
      answer:
        "Verify Weissach Package optioning against the factory sticker (magnesium wheels and dashboard plaque are the visible tells). For MR cars, confirm Manthey paperwork and plaque — MR-claim without Manthey documentation is suspect. Inspect the carbon hood and rear wing for damage or non-original repair. Confirm PCCB disc wear (replacement is $25k+). Check turbocharger service history and coolant-spray intercooling system. Verify matching engine and chassis, complete service book, and commission a specialist PPI — ideally a shop with documented 991 GT turbo experience.",
    },
  ],
  buyerConsiderations: [
    "Weissach Package is the specification that has held value most reliably. If the budget allows, a Weissach car is the better long-term choice than an equivalent-condition standard.",
    "Manthey MR claims require Manthey paperwork. An 'MR-style' car without Manthey plaque and documentation is not an MR and should not be priced as one.",
    "PCCB ceramic brakes are standard. Replacement cost is significant ($25k+ for a full set). Confirm remaining disc life at PPI.",
    "Turbocharger condition, coolant-spray intercooling system health, and full service history are non-negotiable. This is a high-output motorsport-derived engine and maintenance matters.",
    "Carbon hood and rear wing damage is common and often expensively repaired. Original, undamaged carbon retains the most value.",
    "The 992 GT2 RS category remains undelivered as of the current model cycle. Buyers taking a long position on the 991 GT2 RS should model scenarios where the 992 GT2 RS arrives strongly, weakly, or not at all — each has distinct implications for 991 GT2 RS residuals.",
  ],
  thesis:
    "The 991 GT2 RS is the performance apex of its generation and, for now, the defining modern GT2. The ≈1,000-unit production is larger than the 997 GT2 RS (500 units) but the car is more relevant to current performance conversations and holds the Nordschleife record context. Values re-rated aggressively in 2022 and have since stabilized; further appreciation is plausible but not structurally inevitable. Weissach-optioned cars are the better long-term hold than standard. It is a performance-era blue-chip with real downside support but less asymmetric upside than it had three years ago.",
  keywords: [
    "Porsche 991 GT2 RS",
    "991 GT2 RS for sale",
    "991 GT2 RS Weissach Package",
    "Manthey Racing GT2 RS MR",
    "991 GT2 RS Nürburgring record",
    "991 GT2 RS price 2026",
    "997 GT2 RS vs 991 GT2 RS",
    "911 Turbo S vs GT2 RS",
    "991 GT2 RS PDK",
    "Porsche 690 hp 911",
    "991 GT2 RS production",
    "991 GT2 RS investment",
  ],
};
