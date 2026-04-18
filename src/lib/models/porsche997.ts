import type { PorscheModelPage } from "./types";

export const porsche997: PorscheModelPage = {
  slug: "997",
  shortName: "997",
  fullName: "Porsche 911 (997)",
  tagline: "Peak analog water-cooled — the last Mezger, the last pure 6-speed 911.",
  indexSlug: "water-cooled-911",
  intro: [
    "The 997 arrived in 2005 as a deliberate corrective to the 996 — classic round headlights returned, the interior was rebuilt from scratch, and the chassis was refined rather than reinvented. Produced from 2005 to 2012, the 997 bridges two distinct Porsche eras: the analog, hydraulic-steering, Mezger-engine generation, and the modern electrified, PDK-dominant 911 that followed.",
    "The generation splits into two phases. The 997.1 (2005–2008) continued the M96/M97 engine family on Carreras — including the bore-scoring risk that would define its reputation — while carrying the Mezger engine into Turbo, GT3, and GT2 variants. The 997.2 (2009–2012) introduced direct fuel injection (DFI) on Carreras, eliminating IMS and bore-scoring concerns, and debuted the PDK dual-clutch gearbox. Crucially, the 997.2 GT3, GT3 RS, GT3 RS 4.0, and GT2 RS retained the Mezger engine — making 997.2 GT cars the apex of the Mezger lineage.",
    "Enthusiast consensus treats the 997 as the last great analog 911: the final generation with hydraulic steering, available 6-speed manual across the range, and the Mezger racing engine in its GT variants. That consensus has translated directly into market behavior — 997 GT cars are already blue-chip, and manual Carreras have pulled firmly away from automated equivalents.",
  ],
  specs: {
    yearRange: "2005–2012",
    production: "≈213,000 units (all variants)",
    engine: "3.6L / 3.8L flat-six (M96/M97 on 997.1, DFI MA1 on 997.2), water-cooled",
    power: "325 hp (3.6 Carrera) — 355 hp (3.8 Carrera S); up to 620 hp (GT2 RS)",
    transmission: "6-speed manual, 5-speed Tiptronic S (997.1), 7-speed PDK (997.2)",
    zeroToSixty: "4.8s (Carrera) — 3.4s (GT2 RS)",
    topSpeed: "177 mph (Carrera) — 205 mph (GT2 RS)",
    curbWeight: "≈3,075 lb (Carrera coupe)",
  },
  variants: [
    { name: "Carrera / Carrera S", yearRange: "2005–2012", note: "RWD base and 3.8L S. 997.1 uses M96/M97; 997.2 uses DFI MA1 — the DFI cars avoid IMS and bore-scoring concerns." },
    { name: "Carrera 4 / 4S", yearRange: "2006–2012", note: "AWD widebody on 4S. Modest discount to RWD S on Carrera market; 4S widebody preferred over narrow C4." },
    { name: "Targa 4 / 4S", yearRange: "2007–2012", note: "Sliding glass roof, AWD only on 997-generation Targa. Niche; low production supports values." },
    { name: "Turbo", yearRange: "2007–2012", note: "Mezger 3.6L (997.1) and DFI 3.8L (997.2). 997.1 Turbo is the last Mezger Turbo and has a dedicated collector following." },
    { name: "Turbo S", yearRange: "2011–2012", note: "530 hp, PDK only, all options standard. 997.2 Turbo S is a refined grand tourer; values firm." },
    { name: "GT3", yearRange: "2007–2011", note: "Mezger 3.6L (997.1) and Mezger 3.8L (997.2). Manual only. 997.2 GT3 is the peak Mezger GT3 for many collectors." },
    { name: "GT3 RS (3.6)", yearRange: "2007–2009", note: "997.1 RS, ≈1,909 units globally. Lightweight spec, wider track, Mezger 3.6L." },
    { name: "GT3 RS (3.8)", yearRange: "2010–2011", note: "997.2 RS with Mezger 3.8L, ≈1,800+ units. A blue-chip modern 911." },
    { name: "GT3 RS 4.0", yearRange: "2011", note: "≈600 units. 500 hp, Mezger 4.0L — apex of the 997 generation and of the naturally aspirated Mezger lineage. Seven-figure territory at the top." },
    { name: "GT2", yearRange: "2008–2009", note: "RWD twin-turbo Mezger 3.6L, 530 hp. Manual only. ≈1,242 units." },
    { name: "GT2 RS", yearRange: "2011", note: "620 hp Mezger, ≈500 units. Blue-chip; trades well into six figures, top examples seven." },
    { name: "Speedster", yearRange: "2010", note: "Low-cut windshield, PDK only, ≈356 units. Divisive styling; collector-only." },
  ],
  faqs: [
    {
      question: "What is the difference between 997.1 and 997.2?",
      answer:
        "The 997.2 (2009–2012 model years) introduced direct fuel injection on Carreras — eliminating IMS bearing and bore-scoring concerns — and debuted the 7-speed PDK dual-clutch gearbox alongside the 6-speed manual. Interior tech was updated (PCM 3.0), LED daytime running lights were added, and power increased modestly. On GT cars and Turbo, the 997.2 also brought a larger 3.8L Mezger to GT3/GT3 RS and a DFI 3.8L twin-turbo on Turbo/Turbo S.",
    },
    {
      question: "Is the 997.1 bore-scoring problem real?",
      answer:
        "Yes. 997.1 Carrera S and Carrera 4S engines (3.8L M97) have a documented incidence of cylinder bore scoring, particularly cylinder 6, that in severe cases requires engine rebuild or replacement. The 3.6L 997.1 Carrera is less commonly affected but not immune. A borescope inspection of all cylinders is essential on any 997.1 PPI. The DFI 997.2 engine (MA1) is not subject to this failure mode.",
    },
    {
      question: "What is the best 997 to buy for a collector?",
      answer:
        "For pure collector grade, the 997.2 GT3 RS 4.0 sits at the apex — it is the last Mezger, the last naturally aspirated RS before turbocharging, and production was ≈600 units. Below that, the 997.2 GT3, GT3 RS 3.8, and GT2 RS are all firmly blue-chip. Among Carreras, a 997.2 Carrera S manual coupe in collector spec is the most broadly appreciated daily-usable 997.",
    },
    {
      question: "What is the Mezger engine and why does it matter?",
      answer:
        "The Mezger engine — named for Porsche engineer Hans Mezger — is a dry-sump flat-six architecture derived directly from the 911 GT1 Le Mans racing engine. It was used in 996 and 997 Turbo, GT2, GT2 RS, GT3, and GT3 RS models, and is mechanically unrelated to the M96/M97 road-car engines. It has no IMS bearing in the failure-prone configuration and is regarded as one of the most durable high-performance engines Porsche ever built. Mezger presence is a primary driver of collector value.",
    },
    {
      question: "Should I buy a 997 manual or PDK?",
      answer:
        "For collector value, manual. On 997.2 Carreras, manual examples trade at a 15–25% premium over PDK equivalents and that gap has widened over time. On GT3 and GT3 RS, manual is the only option. PDK is faster, more efficient, and better for track use — but the market has firmly rewarded the third pedal.",
    },
    {
      question: "How much does a 997 GT3 RS 4.0 cost?",
      answer:
        "The 997.2 GT3 RS 4.0 trades in the $600k–$900k range for clean, low-mileage examples, with documented collector-grade cars clearing a million. Approximately 600 units were produced globally and attrition to track cars has thinned the population further. It is the highest-valued 997 variant and among the most sought-after modern Porsches.",
    },
    {
      question: "How much does a Porsche 997 cost in 2026?",
      answer:
        "Clean 997.1 Carrera coupes typically trade $35k–$55k; 997.2 Carrera S manual $60k–$90k. 997.1 Turbo manual $75k–$110k; 997.2 Turbo S $110k–$170k. 997.1 GT3 $130k–$180k; 997.2 GT3 $170k–$240k. GT3 RS 3.6 $200k–$280k; GT3 RS 3.8 $300k–$450k; GT2 RS $500k–$750k. Check the MonzaHaus Water-Cooled 911 Index for current medians.",
    },
    {
      question: "Is a 997 a good investment?",
      answer:
        "Manual 997.2 Carreras and all 997 GT variants have appreciated steadily for several years, supported by the generation's status as the last Mezger and last hydraulic-steering 911. Base PDK Carreras have been flatter. As with any collector car, entry price, documentation, and originality matter more than generational thesis.",
    },
    {
      question: "What are common problems on a 997?",
      answer:
        "On 997.1 Carreras: IMS bearing (lower incidence than 996 but still present), bore scoring on M97 3.8L, AOS failures, coil pack failures, and rear main seal leaks. On 997.2 Carreras: high-pressure fuel pump issues, occasional injector failures, and water pump wear. Mezger-engined GT and Turbo cars are mechanically robust but expensive to service; track history should be documented.",
    },
    {
      question: "Can I daily-drive a Porsche 997?",
      answer:
        "Yes, comfortably. The 997 is one of the most daily-usable 911 generations — refined interior, good ergonomics, strong HVAC, and ride quality that tolerates real-world roads. Owners routinely cover 10,000+ miles per year. A 997.2 Carrera avoids the largest 997.1 engine risks and is particularly well-suited to high-mileage ownership.",
    },
  ],
  buyerConsiderations: [
    "997.1 vs 997.2 is the most important purchase decision — 997.2 avoids IMS and bore-scoring risk on Carreras and commands a justified premium.",
    "Manual transmission commands a 15–25% premium across variants and is the clear collector preference; the gap is widening, not narrowing.",
    "Borescope inspection is non-negotiable on 997.1 Carrera S and 4S — bore scoring can hide behind clean oil analysis.",
    "Mezger-engined cars (all 997 Turbo, GT2, GT2 RS, GT3, GT3 RS) are a distinct asset class — evaluate them on GT-car comps, not Carrera comps.",
    "Track history on GT cars is not automatically disqualifying but must be fully documented; untracked GT3 and RS examples carry a meaningful premium.",
    "Original paint, single-digit owner counts, and full dealer service history drive outsized premiums on collector-spec 997s.",
  ],
  thesis:
    "The 997 has settled into its role as the last analog water-cooled 911 and the market is pricing it accordingly. Manual 997.2 Carreras and all 997 GT variants continue to show steady appreciation, with the GT3 RS 4.0 and GT2 RS already in blue-chip territory. PDK base Carreras and Tiptronic 997.1 examples have been flatter and are more exposed to broad market softness. The generational thesis is durable; the execution risk is buying condition and spec.",
  keywords: [
    "Porsche 997",
    "Porsche 911 997",
    "997 Carrera",
    "997 Carrera S",
    "997 Turbo",
    "997 GT3",
    "997 GT3 RS",
    "997 GT3 RS 4.0",
    "997 GT2 RS",
    "Mezger engine",
    "997 buyer's guide",
    "997 investment",
  ],
};
