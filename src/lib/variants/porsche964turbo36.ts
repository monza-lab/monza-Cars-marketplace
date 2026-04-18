import type { PorscheVariantPage } from "./types";

export const porsche964turbo36: PorscheVariantPage = {
  slug: "964-turbo-36",
  shortName: "964 Turbo 3.6",
  fullName: "Porsche 911 (964) Turbo 3.6",
  parentModelSlug: "964",
  tagline: "The last analog single-turbo 911 — apex of the air-cooled Turbo lineage.",
  intro: [
    "The 964 Turbo 3.6 replaced the earlier 964 Turbo 3.3 for the final two model years of the 964 run. Where the 3.3 carried over the 930-era M30/69 engine, the 3.6 brought the modern M64/50 air-cooled flat-six — a naturally-aspirated 3.6L block force-fed by a single KKK K27 turbocharger — producing approximately 360 hp and 383 lb-ft. It is, by consensus, the quickest and most rewarding of the single-turbo air-cooled 911s.",
    "Only ≈1,437 units were built across 1993 and 1994, making it significantly rarer than the 964 Turbo 3.3 (≈3,660 units) that preceded it. It was also the last single-turbo 911: the 993 Turbo that followed adopted twin-turbo architecture and all-wheel drive. The 964 Turbo 3.6 is therefore the final evolution of a lineage that began with the 1975 930 — a rear-wheel-drive, single-turbo, analog air-cooled 911 refined to its peak expression.",
    "Collectors treat the 964 Turbo 3.6 as the apex analog Turbo. Strong driver-grade cars now trade $350k–$500k; excellent low-mileage examples $500k–$650k; and the rare X88 and Turbo S Flachbau variants well into seven figures. Values have re-rated upward since 2018 as the market has internalized the 3.6's rarity relative to the 3.3 and its mechanical superiority.",
  ],
  yearRange: "1993–1994",
  production: "≈1,437 units (all markets, 1993 and 1994 combined)",
  significance: [
    "The 964 Turbo 3.6 is the final chapter of the single-turbo air-cooled 911 story. From the 1975 930 through the 964 Turbo 3.3 and culminating in the 3.6, Porsche refined a single-blower, rear-wheel-drive turbo formula that the 993 Turbo would abandon in favor of twin turbos and AWD. The 3.6 is the purest and most powerful expression of that lineage.",
    "Its collector premium over the 3.3 reflects three things: scarcity (≈1,437 vs ≈3,660), engine modernity (M64/50 vs M30/69), and outright performance (≈360 hp vs 320 hp). The X88 and Turbo S Flachbau sub-variants sit one tier above, traded rarely and treated as reference cars when they do surface.",
  ],
  specs: [
    { label: "Engine", value: "3.6L M64/50 air-cooled flat-six, single KKK K27 turbocharger" },
    { label: "Power", value: "360 hp @ 5,500 rpm" },
    { label: "Torque", value: "383 lb-ft @ 4,200 rpm" },
    { label: "Transmission", value: "G50/52 5-speed manual" },
    { label: "Drive", value: "Rear-wheel drive" },
    { label: "Weight", value: "≈1,470 kg (3,241 lb)" },
    { label: "0–100 km/h (0–62 mph)", value: "4.8 s" },
    { label: "Top speed", value: "280 km/h (174 mph)" },
    { label: "Brakes", value: "Cross-drilled vented discs, Brembo fixed calipers (ex-962-derived)" },
    { label: "Wheels", value: "18-inch 3-piece Speedline (Cup wheel look), 8×18 front / 10×18 rear" },
    { label: "Body", value: "Turbo widebody fenders, fixed whale-tail rear wing with air intake" },
  ],
  identifiers: [
    { label: "VIN pattern", value: "WP0ZZZ96ZPS47XXXX (1993) / WP0ZZZ96ZRS47XXXX (1994) — '47' Turbo body-type digits" },
    { label: "Engine code", value: "M64/50 (Euro) / M64/50S for X88/Turbo S" },
    { label: "Body", value: "Widebody Turbo fenders, wider rear quarters, whale-tail wing with intake slot — distinguishes it from narrow-body Carrera 2/4" },
    { label: "Interior", value: "Leather Sport seats standard, turbo boost gauge in instrument binnacle, G50/52 short-throw shifter" },
    { label: "Wheels", value: "18-inch 3-piece Speedline — Turbo 3.3 used 17-inch; wheel size is a fast visual tell" },
    { label: "Option codes", value: "X88 power pack (engine upgrade to ≈385 hp); M505/M506 Flachbau (slant-nose) for Turbo S; X83 and X84 for cosmetic upgrades" },
  ],
  subVariants: [
    { name: "964 Turbo 3.6 (standard)", yearRange: "1993–1994", production: "≈1,437 total", note: "Base car. 360 hp, widebody, whale-tail. The reference 3.6 and the volume variant within the 3.6 run." },
    { name: "964 Turbo 3.6 X88", yearRange: "1993–1994", production: "≈80 units", note: "Factory power-pack option. Upgraded pistons, cams, intake and exhaust tuning for ≈385 hp. Limited build slots. Concours X88 cars trade $900k–$1.2M+." },
    { name: "964 Turbo S Flachbau (Slantnose)", yearRange: "1994", production: "≈76 units (US + Euro combined)", note: "Factory slant-nose body with 964-era 968-style pop-up headlights, NACA brake ducts, air extractors behind front wheels. Includes the X88 engine as standard. Apex 964 Turbo — recent sales $1.4M–$2M+." },
    { name: "964 Turbo S 'Package'", yearRange: "1993", production: "≈17 units (Euro-market slant-nose, pre-Flachbau numbering)", note: "Very small-batch Euro-market Turbo S precursors, occasionally conflated with the 1994 Flachbau. Documentation-sensitive; treat each example individually." },
  ],
  priceBands: [
    { label: "Driver-grade standard", range: "$300k–$400k", note: "Original paint, documented history, 40-80k km, no X88/Flachbau optioning" },
    { label: "Excellent standard", range: "$400k–$550k", note: "Matching numbers, original paint, low mileage, full service history" },
    { label: "Concours standard", range: "$550k–$700k", note: "Zero-issue matching-numbers with provenance and single-owner history preferred" },
    { label: "X88", range: "$750k–$1.2M+", note: "Premium reflects ≈80-unit scarcity plus factory 385 hp pack" },
    { label: "Turbo S Flachbau", range: "$1.4M–$2M+", note: "Apex 964 Turbo. Thin trade volume; each sale is watched by the market" },
  ],
  faqs: [
    {
      question: "What's the difference between the 964 Turbo 3.3 and the 964 Turbo 3.6?",
      answer:
        "The 3.3 (1991-1992, ≈3,660 units) carries the carryover M30/69 engine from the 930 era — 320 hp and an earlier single-turbo architecture. The 3.6 (1993-1994, ≈1,437 units) switches to the modern M64/50 block producing ≈360 hp and 383 lb-ft, with revised brakes (Brembo fixed calipers, cross-drilled discs), 18-inch Speedline wheels vs 17-inch Cup on the 3.3, and the G50/52 transmission. The 3.6 is faster, rarer, and commands a meaningful premium — driver-grade 3.6s start where 3.3s trade as excellent examples.",
    },
    {
      question: "Why is the 964 Turbo 3.6 considered the collector apex of the single-turbo 911s?",
      answer:
        "Three reasons. First, rarity: ≈1,437 units is less than half the 3.3 production. Second, engine: the M64/50 is the modern air-cooled block, not the carryover 930-era M30 — it's the engine Porsche built for the 964 platform, pressurized for turbo duty. Third, lineage terminus: it is the last single-turbo 911. The 993 Turbo adopted twin turbos and AWD. The 964 Turbo 3.6 is therefore the final expression of a design philosophy that ran from 1975 to 1994.",
    },
    {
      question: "How many 964 Turbo 3.6 were made?",
      answer:
        "Approximately 1,437 units total across 1993 and 1994, across all markets. Within that total, ≈80 received the X88 factory power-pack option and ≈76 received the Turbo S Flachbau (slant-nose) body, with an additional small Euro-market batch of ≈17 Turbo S-designated cars from 1993. The volume standard 964 Turbo 3.6 therefore represents roughly 1,260 units — still a small number by modern collector-variant standards.",
    },
    {
      question: "What's the X88 option and why does it matter?",
      answer:
        "X88 is a factory-ordered engine power pack on the 964 Turbo 3.6. It added revised pistons, camshafts, intake and exhaust tuning to lift output from ≈360 hp to ≈385 hp. Approximately 80 cars were built with X88. Documented X88 cars trade at a significant premium — $750k–$1.2M+ in concours condition — versus standard 3.6 money. Authentication requires the original build sheet and/or Porsche Certificate of Authenticity confirming the X88 code on the factory sticker; retrofits exist and are discounted sharply.",
    },
    {
      question: "What is the Turbo S Flachbau (Slantnose) and how many were made?",
      answer:
        "The 964 Turbo S Flachbau is a 1994-model-year factory slant-nose variant with 968-style pop-up headlights, NACA brake-cooling ducts, air extractors behind the front wheels, and the X88 engine (≈385 hp) as standard. Approximately 76 cars were built across US and Euro markets combined in 1994, with a small earlier Euro batch of ≈17 Turbo S-designated cars in 1993 that are sometimes conflated with the Flachbau. Clean documented Flachbau cars trade $1.4M–$2M+. It is the apex 964 Turbo and one of the rarest factory-spec 911s.",
    },
    {
      question: "What are the known issues on a 964 Turbo 3.6?",
      answer:
        "Three recurring items: engine case sealing and oil leaks at the case halves and chain housings (common to all 964 M64 engines but less forgiving under turbo loads), front wheel bearings and front suspension bushings (the front end is heavier and worked hard by the widebody), and dual-mass flywheel wear. Turbo-specific: KKK K27 turbocharger condition, wastegate operation, and intercooler piping integrity. Electrical: DME relay and AC system. Bodywork: check for front-end impact — the widebody fenders are expensive to source and correctly repair.",
    },
    {
      question: "Can I daily-drive a 964 Turbo 3.6?",
      answer:
        "Mechanically yes; economically questionable. The car has AC, power windows, full interior trim, and the G50/52 is tractable in traffic. Some owners drive them regularly. But mileage is scrutinized closely on a ≈1,437-unit car, and each 10,000 km added has a measurable value impact on an excellent-condition example. Most collectors drive 2,000–5,000 km/year. The Turbo 3.6 rewards use — but the market penalizes heavy use. If daily driving is the goal, a 993 Turbo or 996 Turbo is a better vehicle for the money.",
    },
    {
      question: "How do I authenticate a 964 Turbo 3.6?",
      answer:
        "Check VIN (1993: WP0ZZZ96ZPS47XXXX; 1994: WP0ZZZ96ZRS47XXXX — '47' body-type digits confirm Turbo), engine number (M64/50 stamped on the block), Porsche Certificate of Authenticity confirming factory build spec and any option codes (X88, M505/M506 for Flachbau, X83/X84 for cosmetic), matching-numbers body/engine/transmission, and specialist pre-purchase inspection. A car sold as X88 or Flachbau without a COA documenting the factory codes should be declined.",
    },
    {
      question: "Is the 964 Turbo 3.6 a better investment than a 993 Turbo?",
      answer:
        "They are different instruments. The 964 Turbo 3.6 is the scarcer, more analog, single-turbo RWD terminus — ≈1,437 units, with meaningful further upside in X88 and Flachbau variants. The 993 Turbo is the first twin-turbo AWD 911, built in much larger numbers (≈5,978 combined with Turbo S), more usable as a car, and currently trades lower for standard examples. The 993 Turbo S outperforms both on recent appreciation curves at the top tier. For absolute rarity and purity, the 964 Turbo 3.6 leads; for daily usability and a lower entry point, the 993 Turbo leads.",
    },
    {
      question: "What should I prioritize on a 964 Turbo 3.6 PPI?",
      answer:
        "Matching numbers (body, engine M64/50, transmission), COA confirming any factory option codes, engine case condition (leaks, prior open-engine work, cylinder leak-down numbers), turbocharger health (boost behavior, shaft play, oil seal condition), transmission synchro health (particularly 2nd gear), suspension and wheel-bearing condition, original paint verification via paint-depth gauge on all panels, and chassis alignment (verifying no unrepaired front-end impact). Always use a 964-specialist, not a general Porsche shop.",
    },
  ],
  buyerConsiderations: [
    "X88 and Flachbau authentication is the single biggest value question — insist on original COA plus period build documentation; retrofits trade at a sharp discount.",
    "Matching-numbers status is non-negotiable at the $500k+ tier. An engine replacement history can cut value by 25-40%, depending on what's been substituted.",
    "Original paint is preferred. High-quality respray is tolerated on driver-grade cars but discounts concours-tier pricing by 15-25%. Accident history is a harder penalty.",
    "Service history by recognized 964-Turbo specialists matters — the M64/50 with turbo load is unforgiving of neglect, and prior open-engine work without documentation is a material risk.",
    "Turbo S 'Package' (1993 Euro-market ≈17-unit batch) is a documentation-sensitive sub-category — treat each example on its own merits and verify factory designation in writing.",
    "Widebody panels are expensive to repair correctly; insist on paint-depth readings and panel-gap checks before signing.",
  ],
  thesis:
    "The 964 Turbo 3.6 re-rated meaningfully between 2018 and 2023 as the market internalized its rarity relative to the 3.3 and its status as the final single-turbo 911. From current levels, standard 3.6 appreciation is likely to track broader blue-chip air-cooled behavior — steady, not aggressive. The X88 and Flachbau sub-variants occupy a scarcer tier; price discovery on these remains thin and reference trades move the market. For collectors building a blue-chip air-cooled core, the standard 3.6 is a long-hold hold; the X88 and Flachbau are reserved for deeper collections with the documentation discipline to authenticate them.",
  keywords: [
    "Porsche 964 Turbo 3.6",
    "964 Turbo 3.6 production",
    "964 Turbo 3.6 X88",
    "964 Turbo S Flachbau",
    "964 Turbo Slantnose",
    "964 Turbo 3.3 vs 3.6",
    "Porsche 964 Turbo for sale",
    "964 Turbo 3.6 price 2026",
    "964 Turbo 3.6 investment",
    "air-cooled 911 Turbo",
    "last single-turbo 911",
    "M64/50 engine",
  ],
};
