import type { PorscheVariantPage } from "./types";

export const porsche993rs: PorscheVariantPage = {
  slug: "993-rs",
  shortName: "993 RS",
  fullName: "Porsche 911 (993) Carrera RS",
  parentModelSlug: "993",
  tagline: "Peak analog 911 — the last air-cooled RS and the reference point for air-cooled purity.",
  intro: [
    "The 993 Carrera RS was Porsche's final air-cooled RS, built for Europe only in 1995 and 1996. It extended the 964 RS formula onto the last air-cooled chassis: a 3.8L M64/20 producing 300 hp, a closer-ratio six-speed, reduced weight, and the stiffer chassis and RS-specific suspension that Porsche's racing department had refined over the preceding two generations.",
    "Production is commonly cited at ≈1,014 Euro cars across plain RS and RS Clubsport specifications, with the Clubsport (M003 option code) accounting for ≈227 units fitted with a welded roll cage, fire-suppression provisions, fixed rear wing, and harness mounts. The plain RS (M002) retains the unique RS aero — front lip and adjustable rear wing — without the cage. Both specifications are narrow-body cars. There is no widebody 993 RS; the widebody 993s are the Turbo, Turbo S, and Carrera 4S/Carrera S — different cars entirely.",
    "The market positions the 993 RS at the top of the air-cooled-RS hierarchy alongside the 964 3.8 RS. Driver-grade cars trade $400k–$550k; excellent examples $550k–$750k; Clubsport and concours-tier cars $750k–$900k+. Values compounded steadily through the 2010s and have held firm since — this is established blue-chip territory, not a speculative position.",
  ],
  yearRange: "1995–1996",
  production: "≈1,014 units (Euro-only: plain RS ≈787 + RS Clubsport ≈227). No US-market factory RS.",
  significance: [
    "The 993 RS is the final air-cooled RS and, for many collectors, the definitive expression of the RS philosophy. It carries the last iteration of the air-cooled M64 flat-six, pre-water-cooled 996, and is one of the last new 911s a buyer could specify with no ABS on the Clubsport spec, manual everything, and a fixed-back race seat. Everything after it is heavier, more electronic, or water-cooled.",
    "It was Euro-only. The US received no factory 993 RS — any 993 RS in the US is a gray-market import, carrying the usual federalization and documentation questions. This scarcity, combined with its position as the terminus of the air-cooled lineage, explains why 993 RS values have consistently outrun broader 993 Carrera appreciation and why Clubsport examples trade at a firm premium over plain RS.",
  ],
  specs: [
    { label: "Engine", value: "3.8L M64/20 air-cooled flat-six, Varioram intake" },
    { label: "Power", value: "300 hp @ 6,500 rpm" },
    { label: "Torque", value: "262 lb-ft @ 5,400 rpm" },
    { label: "Transmission", value: "G50/31 6-speed manual, closer ratios vs 993 Carrera" },
    { label: "Drive", value: "Rear-wheel drive" },
    { label: "Weight", value: "≈1,270 kg (2,800 lb)" },
    { label: "0–100 km/h (0–62 mph)", value: "5.0 s" },
    { label: "Top speed", value: "277 km/h (172 mph)" },
    { label: "Suspension", value: "Stiffer springs/dampers, lowered ride height, stiffer anti-roll bars, solid engine mounts" },
    { label: "Brakes", value: "Big Red calipers, cross-drilled vented discs — ABS standard on plain RS, optional/deleted on Clubsport builds" },
    { label: "Wheels", value: "Speedline magnesium — 8×18 front / 10×18 rear" },
    { label: "Aero", value: "Unique RS front lip, adjustable rear wing (plain RS); fixed wing on Clubsport" },
  ],
  identifiers: [
    { label: "VIN pattern", value: "WP0ZZZ99ZSS39XXXX (1995) / WP0ZZZ99ZTS39XXXX (1996) — '39' narrow-body Carrera chassis" },
    { label: "Engine code", value: "M64/20" },
    { label: "Body", value: "Narrow-body chassis — critical identifier. All 993 RS are narrow-body. Widebody 993s are Turbo or C4S/C2S, not RS." },
    { label: "Interior", value: "Fixed-back Recaro bucket seats, reduced sound deadening, no rear seats, RS-specific door cards, three-spoke RS steering wheel" },
    { label: "Option codes", value: "M002 = plain RS; M003 = Clubsport (roll cage, fire prep, fixed wing, harness mounts)" },
    { label: "Exterior", value: "RS front lip, unique Speedline magnesium wheels, RS badging on rear deck lid, Clubsport has fixed rear wing and often period-correct racing livery delete" },
  ],
  subVariants: [
    { name: "993 RS (M002 — plain RS)", yearRange: "1995–1996", production: "≈787 units", note: "Road-focused RS with adjustable rear wing, no roll cage, ABS standard. The volume RS spec." },
    { name: "993 RS Clubsport (M003)", yearRange: "1995–1996", production: "≈227 units", note: "Adds welded-in roll cage, fire-suppression prep, harness mounts, fixed carbon rear wing, and track-focused chassis tuning. Blue-chip within the RS range; trades at a firm premium." },
  ],
  priceBands: [
    { label: "Driver-grade plain RS", range: "$400k–$550k", note: "Original paint, documented history, 30-60k km, full service history" },
    { label: "Excellent plain RS", range: "$550k–$700k", note: "Matching numbers, original paint, low mileage, single-owner preferred" },
    { label: "Concours plain RS", range: "$700k–$850k", note: "Zero-issue matching-numbers with full provenance and preservation-class paint" },
    { label: "Clubsport (M003)", range: "$700k–$950k+", note: "Premium over plain RS reflects ≈227-unit scarcity and homologation-spec cage/aero" },
  ],
  faqs: [
    {
      question: "How many 993 RS were made?",
      answer:
        "Approximately 1,014 units total, Euro-market only, across the 1995 and 1996 model years. Of that total, ≈787 were plain RS (M002) and ≈227 were RS Clubsport (M003). There was no factory US-market 993 RS — US examples are gray-market imports.",
    },
    {
      question: "What's the difference between a 964 RS and a 993 RS?",
      answer:
        "Both are RS-spec air-cooled 911s but from consecutive generations. The 964 RS (1992-1993, ≈2,051 Euro units across all sub-variants) uses a 3.6L M64/03 at 260 hp with a 5-speed G50/10; base Lightweight has no ABS. The 993 RS (1995-1996, ≈1,014 Euro units) uses a 3.8L M64/20 at 300 hp with a 6-speed G50/31, revised multi-link rear suspension (vs 964's semi-trailing arm), and Big Red brakes. The 993 RS is faster, more refined, and narrower in production; the 964 RS is the purer, more analog statement. Both are blue-chip; both have appreciated durably.",
    },
    {
      question: "What's the difference between the 993 RS and 993 RS Clubsport?",
      answer:
        "The plain RS (M002) is the road-focused specification — RS front lip, adjustable rear wing, RS interior, ABS, no roll cage. The Clubsport (M003) adds a welded-in roll cage, fire-suppression prep, harness mounts, a fixed carbon rear wing, and track-focused chassis tuning. The Clubsport is the homologation-adjacent spec and trades at a firm premium reflecting its ≈227-unit scarcity versus ≈787 plain RS.",
    },
    {
      question: "Is there a widebody 993 RS?",
      answer:
        "No. All 993 RS cars — both plain M002 and Clubsport M003 — are narrow-body. The widebody 993 shell was used for the Turbo, Turbo S, and the Carrera 4S and Carrera S. Any 993 described as 'widebody RS' is either mislabeled (often a C4S misidentified as an RS) or a modified car. The narrow body is a fundamental RS identifier and a non-negotiable check on any 993 RS authentication.",
    },
    {
      question: "What's the difference between the 993 RS and the 993 GT2?",
      answer:
        "Different cars. The 993 RS is a normally-aspirated 3.8L, 300 hp, narrow-body, rear-wheel-drive homologation road car for GT3 racing (≈1,014 units). The 993 GT2 is a twin-turbo widebody 3.6L, 430 hp (later 450 hp Evo), rear-wheel-drive homologation for GT2-class racing (≈172 street cars + GT2 Evo variants). They share a generation but represent opposite ends of Porsche's 993 motorsport program. The GT2 is scarcer and trades higher ($2M+ for street cars); the RS is the naturally-aspirated purist's RS benchmark.",
    },
    {
      question: "How do I authenticate a 993 RS?",
      answer:
        "Check VIN (narrow-body '39' chassis digits — WP0ZZZ99ZSS39XXXX for 1995, WP0ZZZ99ZTS39XXXX for 1996), engine number M64/20, Porsche Certificate of Authenticity confirming M002 (plain RS) or M003 (Clubsport) option code, matching-numbers body/engine/transmission, original RS-specific interior (fixed-back Recaros, three-spoke RS wheel, specific door cards), Speedline magnesium wheels, and specialist pre-purchase inspection. A 993 advertised as RS without a COA confirming M002 or M003 should be declined — imitation kits exist and are well-executed.",
    },
    {
      question: "Why is the 993 RS called 'peak analog 911'?",
      answer:
        "It is the final air-cooled 911 RS, built before the 996 introduced water-cooling, multi-link front suspension, and significantly more electronic intervention. The 993 RS kept hydraulic steering, modest electronic aids (ABS only; no stability control), a manual six-speed, and an air-cooled flat-six in its most refined form. After 1996, no new 911 would be air-cooled; after the 991, no new 911 would use hydraulic steering. The 993 RS is the last moment where all those analog attributes coexist in a new-build RS.",
    },
    {
      question: "Is the 993 RS a good investment in 2026?",
      answer:
        "The 993 RS is established blue-chip. Driver-grade plain RS trades $400k–$550k; concours plain RS $700k–$850k; Clubsport well north. Aggressive further multi-bagger returns are unlikely from current entry points, but the scarcity (≈1,014 Euro cars, US-import gray-market risk on any stateside example), terminal-air-cooled status, and documented appreciation trajectory suggest values are unlikely to retreat materially. It is a hold, not a flip, and the Clubsport is the stronger-conviction hold within the range.",
    },
    {
      question: "What should I check on a 993 RS pre-purchase inspection?",
      answer:
        "Beyond standard 993 items (valve guides on pre-Varioram cars — less of an issue on RS due to M64/20 spec, dual-mass flywheel, secondary air pump): RS-specific checks include M002/M003 option code via COA, original Recaro fixed-back buckets, original Speedline magnesium wheels (often swapped), aluminum hood originality, roll cage integrity on Clubsport (rust, weld quality, prior repair), chassis alignment (many RS tracked hard), and matching-numbers engine and transmission. Always use a 993-specialist shop and insist on a paint-depth reading across all panels.",
    },
    {
      question: "What makes the Clubsport worth the premium over the plain RS?",
      answer:
        "Three factors. First, scarcity: ≈227 Clubsport vs ≈787 plain RS. Second, specification: the welded roll cage, fire-suppression prep, harness mounts, fixed carbon wing, and track-focused tuning mark the Clubsport as the homologation-adjacent spec — closer in spirit to a customer race car. Third, historical signal: Clubsport cars were more often ordered by owners with track intent, and a well-preserved street-driven Clubsport is therefore scarcer still. The premium typically runs 15-25% over equivalent-condition plain RS, with concours Clubsport examples approaching the $900k–$950k band.",
    },
  ],
  buyerConsiderations: [
    "Narrow body is non-negotiable — any 993 RS is narrow-body. A widebody car described as RS is misidentified or modified. Walk.",
    "Porsche Certificate of Authenticity confirming M002 or M003 is mandatory. Without COA, treat as a Carrera with RS parts.",
    "Matching-numbers status is essential at the $500k+ tier; engine replacement history can cut value 25-40% depending on substitution.",
    "US-market cars are gray-market imports — verify federalization paperwork, state-level registration viability, and import documentation chain.",
    "Clubsport cage integrity is load-bearing value — verify welds, inspect for corrosion, and confirm the cage is original factory rather than aftermarket retrofit.",
    "Original paint is preferred; high-quality respray tolerated on driver-grade cars but discounts concours tier by 15-20%. Accident history is a harder penalty on a ≈1,014-unit car.",
  ],
  thesis:
    "The 993 RS sits at the top of the air-cooled-RS hierarchy alongside the 964 3.8 RS, and as the final air-cooled RS it has a scarcity and terminal-generation story that the market has fully priced. Further aggressive appreciation from current levels is unlikely; steady compounding in line with blue-chip air-cooled benchmarks is the realistic expectation. The Clubsport is the stronger-conviction sub-variant — scarcer, more specific, and with a firmer price floor. Both are long-hold preservation assets, not trading positions.",
  keywords: [
    "Porsche 993 RS",
    "993 Carrera RS",
    "993 RS Clubsport",
    "993 RS production",
    "993 RS M003",
    "993 RS M002",
    "Porsche 993 RS for sale",
    "993 RS price 2026",
    "993 RS investment",
    "last air-cooled RS",
    "993 RS vs 964 RS",
    "993 RS authentication",
  ],
};
