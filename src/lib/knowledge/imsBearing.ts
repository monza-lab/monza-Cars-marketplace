import type { KnowledgeArticle } from "./types";

export const imsBearingArticle: KnowledgeArticle = {
  slug: "ims-bearing",
  title: "Porsche IMS Bearing — Complete Guide for M96/M97 Owners",
  seoTitle: "Porsche IMS Bearing Failure — Causes, Affected Models, Retrofit Options | MonzaHaus",
  summary:
    "Everything a Porsche buyer or owner needs to know about the IMS bearing — which engines are affected (and which aren't), failure rates, retrofit options, and how to protect your purchase.",
  category: "reliability",
  intro: [
    "The IMS (Intermediate Shaft) bearing is the most-discussed reliability issue in modern Porsche ownership. It affects specific M96 and M97 engines used in the 996 Carrera, early 997 Carrera, 986 Boxster, and 987 Boxster/Cayman — and it does NOT affect the Mezger engines used in the 996/997 Turbo, GT2, GT3, and GT3 RS.",
    "When the IMS bearing fails, the consequence can be catastrophic engine damage: a failed bearing disrupts the intermediate shaft, which in turn affects camshaft timing, and the result is typically valve-to-piston contact requiring a full engine rebuild ($15,000–$30,000) or replacement ($25,000–$40,000).",
    "The issue has been extensively litigated (the 2014 class-action settlement) and extensively engineered around. Retrofit solutions exist, diagnostic procedures are well-understood, and a well-informed buyer can mitigate the risk to near-zero. An IMS-affected 996 Carrera with an LN Engineering IMS Solution retrofit is, for all practical purposes, no more risky than a non-IMS-affected car.",
    "This guide covers exactly which engines are affected, the engineering root cause, failure rates, retrofit options with costs, and the pre-purchase inspection procedure specific to IMS diagnosis. It is the canonical MonzaHaus reference on the topic.",
  ],
  sections: [
    {
      heading: "Which engines are affected — and which are not",
      body: [
        "IMS bearing failure is specific to the M96 and M97 engines used in non-Mezger, non-DFI Porsches. The affected engine families are: M96 (1997–2005) and M97 (2005–2008, excluding 2009+ DFI Carreras).",
        "Affected models: 986 Boxster (1997–2004), 987 Boxster (2005–2008 2.7L/3.2L), 987 Cayman (2006–2008), 996 Carrera (1999–2005), 997.1 Carrera / Carrera S (2005–2008).",
        "NOT affected — Mezger engines: 996 Turbo, 996 GT2, 996 GT3, 996 GT3 RS, 997 Turbo, 997 GT2 / GT2 RS, 997 GT3 / GT3 RS / RS 4.0, 997 Turbo S (2010–2012). The Mezger is a completely different engine architecture derived from the 964 block — it uses a different intermediate-shaft design that is not subject to the same bearing failure mode.",
        "NOT affected — DFI MA1 engines: 2009+ 997.2 Carreras and 2009+ 987.2 Boxster/Cayman use Porsche's direct-injection 9A1-family engine (MA1) which eliminated the IMS bearing entirely. These cars are not at risk.",
        "Check by VIN + model year + trim: if you have a water-cooled 911 or mid-engine Porsche from 1997–2008 that is NOT a Turbo/GT3/GT2/GT3 RS and has port-injected 3.4/3.6/3.8 hardware, it has an IMS bearing.",
      ],
    },
    {
      heading: "Single-row vs dual-row IMS bearing",
      body: [
        "Within affected M96/M97 engines, there are two bearing variants: dual-row (1997–2000) and single-row (2001–2005, plus 2005–2008 M97).",
        "The dual-row bearing was used in early 986 Boxster (1997–1999) and 996 (1999–2000 model year). It has a lower failure rate (~3–5%) but still carries nonzero risk.",
        "The single-row bearing was introduced in mid-2000 production as a cost-reduction. Paradoxically, it has a meaningfully higher failure rate (~8–10% per the Eisen class-action study) because it carries less radial load capacity and its sealed grease supply degrades over time. The single-row is the IMS variant that drives most concern.",
        "M97 engines (2005–2008) use a larger, non-replaceable single-row bearing. It cannot be retrofit without a full engine disassembly — making M97 IMS prevention more limited than M96.",
      ],
    },
    {
      heading: "Root cause — why it fails",
      body: [
        "The IMS bearing is a sealed ball bearing that supports the rear end of the intermediate shaft, which in turn drives both camshafts via chains. The bearing is lubricated by a small grease charge sealed at the factory — it is not in the engine's oil circuit.",
        "Over years of thermal cycling, that sealed grease degrades. Once grease integrity is lost, the bearing begins to score, metal particles enter the timing chain, and eventually the bearing seizes. When seizure occurs under load (e.g. startup, acceleration), camshaft timing is lost and the engine suffers internal damage.",
        "Contributing factors identified by LN Engineering's forensic work: short trip usage (prevents oil temperature from driving off moisture), long oil change intervals (Porsche originally spec'd 15,000 miles; most specialists now recommend 5,000–7,500), and the single-row bearing's reduced load capacity.",
      ],
    },
    {
      heading: "Retrofit solutions — LN Engineering",
      body: [
        "LN Engineering (NJ-based, run by Charles Navarro) is the definitive aftermarket authority on IMS retrofits. Their solutions are used by most Porsche-specialist shops globally.",
        "IMS Retrofit Pro — dual-row and single-row M96 engines. Replaces the factory sealed bearing with an open, hybrid ceramic bearing lubricated by the engine's oil supply. Installed cost: $3,500–$5,500 including clutch + rear main seal (these must come out regardless, so retrofit is typically paired). Reduces IMS failure risk to near-zero.",
        "IMS Solution — single-row M96 engines only. Eliminates the bearing entirely, replacing it with a plain journal bearing fed by pressurized engine oil. Considered the definitive permanent solution. Installed cost: $4,500–$6,500. LN Engineering's lifetime warranty when installed by a certified shop.",
        "M97 engines (2005–2008) — the larger, non-removable bearing cannot be retrofit with the above solutions. Options are: preventive monitoring (oil analysis every 5,000 miles, magnetic drain plug), or full engine replacement with an early M96 unit that accepts retrofit.",
      ],
    },
    {
      heading: "Pre-purchase inspection — IMS-specific checks",
      body: [
        "Beyond a standard Porsche PPI, IMS due diligence requires: (1) confirmation of engine family (M96 vs M97 vs Mezger vs DFI MA1) via engine number, (2) single-row vs dual-row identification via model year and production date, (3) confirmation of any prior retrofit via receipts (not just verbal — physical evidence), (4) a borescope oil pan inspection for metal particles, (5) oil analysis (Blackstone or similar) for bearing-wear metals (chromium, iron, manganese), and (6) verification that the oil change interval has been aggressive (5,000–7,500 miles, not 15,000).",
        "An un-retrofitted M96/M97 car with full documentation of aggressive oil changes and clean oil analysis is acceptable risk. An un-retrofitted car with sparse service history, extended oil change intervals, and no oil analysis should be discounted 15–25% to reflect the cost of adding an IMS Solution retrofit and the residual risk.",
        "A well-documented retrofit (with receipts showing LN Engineering parts + certified installer) adds value to an M96 car of roughly $3,000–$5,000 at resale — essentially the retrofit cost. Buyers should verify retrofit documentation matches VIN.",
      ],
    },
  ],
  howTo: {
    name: "How to assess IMS bearing risk on a Porsche before purchase",
    description:
      "Step-by-step IMS due diligence for any 1997–2008 water-cooled Porsche (996/997.1 Carrera, 986/987 Boxster, 987 Cayman).",
    steps: [
      {
        name: "Confirm the engine family",
        text: "Check the VIN and service records for the engine number. M96 or M97 = IMS-affected. Mezger (Turbo, GT3, GT2, GT3 RS) = NOT affected. 2009+ DFI (MA1) = NOT affected. If Mezger or DFI, stop — no IMS concern.",
      },
      {
        name: "Identify single-row vs dual-row",
        text: "Dual-row bearing: early 986 Boxster (1997–1999) and 996 (1999–2000 MY). Single-row: 2001–2005 M96. M97 (2005–2008): larger non-removable bearing. Single-row has the highest failure rate.",
      },
      {
        name: "Request documented service history",
        text: "Demand all service receipts. Aggressive oil changes (5,000–7,500 miles) are protective. Extended intervals (15,000 miles) increase risk. No receipts = assume worst case.",
      },
      {
        name: "Request oil analysis",
        text: "Oil analysis (Blackstone, Wear Check) identifies early bearing wear via elevated chromium, iron, or manganese. $35 per sample. Send a pre-purchase sample — fresh oil after oil change gives the most diagnostic value.",
      },
      {
        name: "Inspect for metal particles",
        text: "Remove oil filter and drain plug. Physical inspection for metallic debris. Magnetic drain plug (common aftermarket upgrade) will hold iron particles — check for any accumulation.",
      },
      {
        name: "Verify any prior retrofit documentation",
        text: "If seller claims an IMS retrofit, demand receipts: LN Engineering part numbers, certified installer invoice, and date. Verbal confirmation alone is not sufficient. A documented retrofit is worth +$3,000 to $5,000 at resale.",
        url: "https://lnengineering.com",
      },
      {
        name: "Factor IMS risk into offer",
        text: "Un-retrofitted with aggressive service + clean oil analysis: acceptable, price reflects small residual risk. Un-retrofitted with poor history: discount 15–25% to fund an IMS Solution retrofit post-purchase. Retrofitted: buy with confidence; this is arguably lower risk than a non-IMS-affected car.",
      },
    ],
  },
  faqs: [
    {
      question: "Does every Porsche have IMS bearing problems?",
      answer:
        "No. The IMS bearing issue is specific to the M96 and M97 engines used in non-turbo, non-GT Porsches from 1997 to 2008. Mezger engines (996/997 Turbo, GT2, GT3, GT3 RS) use a completely different architecture and are NOT affected. 2009+ DFI (MA1) engines eliminated the IMS bearing entirely. Only specific port-injected 3.4/3.6/3.8 M96/M97 engines carry IMS risk.",
    },
    {
      question: "What is the IMS bearing failure rate?",
      answer:
        "Per the 2014 Eisen class-action settlement data: approximately 8–10% for the single-row bearing (2001–2005 M96) and 3–5% for the dual-row bearing (1997–2000 M96). These are lifetime failure rates, not annual. Aggressive oil changes, short trip avoidance, and retrofit meaningfully reduce individual-car risk below these population averages.",
    },
    {
      question: "Should I buy a 996 Carrera despite the IMS bearing?",
      answer:
        "A 996 Carrera with (a) an LN Engineering IMS retrofit, (b) documented aggressive oil changes, or (c) clean recent oil analysis is acceptable risk. A 996 Carrera without any of these with sparse service history is not — discount 15–25% to fund a retrofit post-purchase. The retrofit process is well-understood and the cars are mechanically sound aside from this single issue.",
    },
    {
      question: "How much does an IMS retrofit cost?",
      answer:
        "LN Engineering IMS Retrofit Pro (single or dual-row M96): $3,500–$5,500 installed including clutch and rear main seal (these must be replaced when the bellhousing is open). LN Engineering IMS Solution (single-row M96 only, plain journal bearing): $4,500–$6,500. M97 (2005–2008) engines cannot be retrofit with the above solutions — they require full engine replacement to swap in an M96.",
    },
    {
      question: "Is the 997.1 Carrera affected by IMS?",
      answer:
        "Yes. 2005–2008 997.1 Carrera / Carrera S uses the M97 engine which retains the IMS bearing — a larger, non-replaceable single-row variant. The 997.2 (2009+) introduced DFI (direct fuel injection) and the MA1 engine which eliminated the IMS bearing entirely. A 997.2 is the first IMS-free water-cooled Carrera.",
    },
    {
      question: "Do Porsche Turbo and GT3 models have IMS problems?",
      answer:
        "No. 996 Turbo / GT2 / GT3 / GT3 RS and 997 Turbo / GT2 / GT2 RS / GT3 / GT3 RS / GT3 RS 4.0 all use Mezger engines derived from the 964 block. The Mezger architecture does not have the M96/M97 IMS failure mode. This is a major reason why collector values for Mezger 911s are substantially higher than equivalent M96/M97 cars.",
    },
    {
      question: "Can I tell if an IMS retrofit was done without taking the engine apart?",
      answer:
        "Not definitively without a borescope. The retrofit is invisible externally. Verification methods: (1) demand physical receipts and installer invoice, (2) verify LN Engineering part numbers, (3) check the oil filter and drain plug for clean oil, (4) borescope the bellhousing if the PPI budget allows. If no documentation exists, assume no retrofit was done and price accordingly.",
    },
    {
      question: "Is IMS failure covered under any Porsche warranty?",
      answer:
        "Original Porsche factory warranty expired years ago on all affected cars. The 2014 Eisen class-action settlement provided limited reimbursement for certain documented failures but that program closed in 2018. Current M96/M97 owners are self-insured. Third-party extended warranties (Fidelity, Endurance, etc.) explicitly exclude IMS failure on Porsches. The only protection today is a documented retrofit.",
    },
  ],
  verdict:
    "The IMS bearing issue is real, well-documented, and fully solvable. The affected engine population is specific and identifiable. Retrofit solutions are mature and cost-justified. The collector market has priced IMS-affected M96/M97 cars (996 Carrera, 987 Boxster/Cayman) at significant discounts to Mezger equivalents — creating an opportunity for informed buyers willing to either buy a retrofitted car or fund a retrofit post-purchase. The biggest mistake is ignoring the issue entirely; the second-biggest is overestimating it and walking away from otherwise excellent cars.",
  keywords: [
    "Porsche IMS bearing",
    "IMS bearing failure",
    "996 IMS bearing",
    "987 IMS bearing",
    "M96 engine",
    "M97 engine",
    "LN Engineering IMS",
    "IMS retrofit cost",
    "IMS Solution",
    "Porsche intermediate shaft",
    "996 reliability",
    "Mezger vs M96",
  ],
};
