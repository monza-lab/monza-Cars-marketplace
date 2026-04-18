import type { PorscheModelPage } from "./types";

export const porsche964: PorscheModelPage = {
  slug: "964",
  shortName: "964",
  fullName: "Porsche 911 (964)",
  tagline: "The bridge generation — 85% new under familiar skin.",
  indexSlug: "air-cooled-911",
  intro: [
    "The 964 was Porsche's first substantial redesign of the 911 since 1964 — 85% of the car was new, even if the silhouette kept the classic lines. It introduced coil-spring suspension, ABS brakes, power steering, and all-wheel drive (Carrera 4) to a lineage that had stubbornly resisted modern conveniences for a quarter century.",
    "Produced from 1989 to 1994, the 964 lived in the shadow of the preceding 3.2 Carrera and the succeeding 993 for years. Collectors once considered it the 'awkward middle child'. That view has reversed sharply since ~2016: clean 964 Carreras have tripled, the 964 RS America is a six-figure car, and European RS and Turbo 3.6 examples are firmly in blue-chip territory.",
    "The 964 is air-cooled, mechanically straightforward, and — with modern understanding of its weak points — reliable. It is, arguably, the last 911 where an owner can still work on the car in their own garage.",
  ],
  specs: {
    yearRange: "1989–1994",
    production: "≈63,000 units (all variants)",
    engine: "3.6L flat-six (M64), air-cooled",
    power: "247 hp (Carrera) — 360 hp (Turbo 3.6)",
    transmission: "5-speed manual (G50/03), 4-speed Tiptronic optional",
    zeroToSixty: "5.5s (Carrera 2) — 4.6s (Turbo 3.6)",
    topSpeed: "162 mph (Carrera) — 174 mph (Turbo 3.6)",
    curbWeight: "≈3,031 lb (Carrera 2)",
  },
  variants: [
    { name: "Carrera 2", yearRange: "1990–1994", note: "RWD, the purist's choice. Manual preferred over Tiptronic for collector value." },
    { name: "Carrera 4", yearRange: "1989–1994", note: "First AWD 911. Heavier and more complex; values trail Carrera 2." },
    { name: "Carrera RS", yearRange: "1992–1993", note: "Lightweight homologation special. Europe-only (gray-market in US). Six-figure territory; RS NGT and 3.8 RS are apex." },
    { name: "RS America", yearRange: "1993–1994", note: "US-market lightweight (701 produced). Used to be the budget RS; now $150k+ for clean examples." },
    { name: "Turbo 3.3", yearRange: "1991–1992", note: "Single-turbocharged evolution of the 930. Limited to 2 model years, collector premium." },
    { name: "Turbo 3.6", yearRange: "1993–1994", note: "Apex analog Turbo — 360 hp, naturally aspirated engine block + turbo. Blue-chip." },
    { name: "Speedster", yearRange: "1993–1994", note: "Low-cut windshield, no rear seats. Rare (930 produced). Divisive styling but appreciating." },
  ],
  faqs: [
    {
      question: "Is a Porsche 964 a good investment?",
      answer:
        "The 964 Carrera has appreciated meaningfully since ~2016 and continues to show steady year-over-year gains for clean, documented examples. Rare variants (RS, Turbo 3.6, RS America) have reached blue-chip territory. However, as with any collector car, returns depend on condition, documentation, and buying at a fair price — overpaying at the peak of a cycle erases upside.",
    },
    {
      question: "How much does a Porsche 964 cost in 2026?",
      answer:
        "Clean Carrera 2 coupes typically trade in the $80k–$140k range. Carrera 4 examples sit 10–20% below Carrera 2 values. RS America runs $150k–$250k. Euro RS is $300k–$600k+ depending on spec. Turbo 3.3 typically $150k–$250k, Turbo 3.6 $350k–$650k+. Check the MonzaHaus Air-Cooled 911 Index for the current median.",
    },
    {
      question: "What is the most reliable Porsche 964?",
      answer:
        "The Carrera 2 manual is the mechanically simplest and most reliable 964. It avoids the complexity of the Carrera 4's all-wheel drive system and the turbocharger plumbing of the Turbo. With the dual-mass flywheel, DME relay, and distributor refresh addressed, a well-maintained Carrera 2 can be a daily-usable collector car.",
    },
    {
      question: "What are common problems with a Porsche 964?",
      answer:
        "Dual-mass flywheel wear (replace with single-mass for street use), DME relay failure (causes intermittent no-start), leaking engine cases on early cars (1989–1990 'chain ramp' bulletin applies), distributor vent issues, oil leaks from valve covers and front crank seal, and worn motor mounts. None are catastrophic on a properly maintained car — budget ~$3–5k for a full PPI sort-out.",
    },
    {
      question: "Should I buy a 964 Carrera 2 or Carrera 4?",
      answer:
        "For collector value and driving purity, Carrera 2. The C4's early all-wheel drive system is heavier, more complex, and adds ongoing maintenance cost. The C4 trades at a 10–20% discount versus C2 for the same condition, so it's a viable entry point if year-round traction is required — but the resale ceiling is lower.",
    },
    {
      question: "What's the difference between a 964 and a 993?",
      answer:
        "The 993 (1995–1998) is the final air-cooled 911 and is considered the pinnacle of the analog 911. The 964 introduced modern conveniences (ABS, coil suspension, power steering), but the 993 refined them — multilink rear suspension, smoother power delivery, more rigid body. The 993 commands a ~30–50% premium over equivalent 964s.",
    },
    {
      question: "Is the 964 RS America worth it?",
      answer:
        "For collectors who value US-market provenance and lightweight spec without the Euro RS price, yes. Only 701 RS Americas were built for the US market. Clean, documented examples trade $150k–$250k. It will never reach Euro RS values (~$300k–$600k) but offers a similar driving experience at a fraction of the price.",
    },
    {
      question: "Can I daily-drive a Porsche 964?",
      answer:
        "Yes, within reason. The 964 was designed as a usable 911 — air conditioning, power steering, ABS, modern ergonomics. Owners regularly cover 5,000–10,000 miles per year. For a cold-weather daily, a Carrera 4 makes sense. Avoid rust-prone salt-belt winters; the 964's galvanized shell is strong but not invincible.",
    },
    {
      question: "What should I look for in a 964 pre-purchase inspection?",
      answer:
        "Engine leak-down and compression test, leak check at case halves and valve covers (some leaks are acceptable on a 30+ year-old car), confirm dual-mass flywheel status, DME relay version, transmission synchro health (2nd and 3rd gear), frame damage via panel gaps and seal patterns, documented service history especially timing chain ramp repair on early cars, and original paint via thickness gauge.",
    },
    {
      question: "How many Porsche 964s were made?",
      answer:
        "Approximately 63,000 units across all variants (1989–1994). Of those, roughly 18,000 Carrera 2, 13,000 Carrera 4, 3,660 Turbo 3.3, 1,437 Turbo 3.6, 701 RS America, 2,051 Euro RS, and 930 Speedsters — along with smaller runs of special variants. Scarcity drives the RS and Turbo 3.6 premium.",
    },
  ],
  buyerConsiderations: [
    "Documented service history is the single biggest value lever — a full folder can add $20–40k over an undocumented equivalent.",
    "Original paint retains the strongest value. Respray or panel repaint can reduce value by 15–25% even if immaculate.",
    "Manual transmission commands a 10–15% premium over Tiptronic on Carrera 2 and Carrera 4 variants.",
    "US-market cars carry 'gray market' risk when imported; prefer documented titled-from-new examples.",
    "Budget $3–5k minimum post-purchase for deferred maintenance even on a 'sorted' example.",
    "PPI by a Porsche-specialist shop (not a general import mechanic) is non-negotiable.",
  ],
  thesis:
    "The 964 has completed its transition from underappreciated middle child to recognized collector asset. Standard Carrera 2 and C4 values have stabilized in a clear band; further multi-bagger returns are unlikely at current entry points. The investment case strengthens for rare variants (RS, RS America, Turbo 3.6) where supply is genuinely scarce and demand continues to compound as the 964 generation ages into vintage status.",
  keywords: [
    "Porsche 964",
    "Porsche 911 964",
    "964 Carrera",
    "964 Carrera 2",
    "964 Carrera 4",
    "964 RS",
    "964 RS America",
    "964 Turbo",
    "air-cooled Porsche",
    "964 buyer's guide",
    "964 market value",
    "964 investment",
  ],
};
