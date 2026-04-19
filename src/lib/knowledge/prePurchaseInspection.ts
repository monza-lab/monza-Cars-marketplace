import type { KnowledgeArticle } from "./types";

export const prePurchaseInspectionArticle: KnowledgeArticle = {
  slug: "porsche-pre-purchase-inspection",
  title: "Porsche Pre-Purchase Inspection (PPI) — Complete Checklist",
  seoTitle:
    "Porsche PPI — Pre-Purchase Inspection Checklist, Cost, What to Look For | MonzaHaus",
  summary:
    "The canonical MonzaHaus PPI guide: what a complete Porsche pre-purchase inspection covers, model-specific additions, what it costs, how to choose a specialist shop, and how to act on the findings.",
  category: "ownership",
  intro: [
    "A Pre-Purchase Inspection (PPI) is a professional, third-party evaluation of a Porsche performed by a marque-specialist shop before money changes hands. It is not an oil change, it is not a test drive, and it is not a dealer walk-around — it is a half-day to full-day forensic examination designed to answer one question: is this specific car worth what is being asked, and what will it cost to own over the next five years.",
    "For any collector-value Porsche ($50,000+), a PPI is mandatory. For $100,000+ cars, skipping the PPI is indefensible. The typical PPI costs $500 to $2,500 depending on scope and location — a rounding error against a six-figure purchase price, and routinely the difference between a great buy and a five-figure regret. Documented cases across the MonzaHaus network show PPIs catching hidden accident damage, bore scoring, incomplete IMS retrofits, and VIN inconsistencies that would have cost buyers $20,000 to $80,000 post-sale.",
    "The PPI is best understood as insurance for the transaction. You are paying a Porsche specialist to put the car on a lift, run compression and leak-down tests, scope the cylinders, scan the DME, measure paint thickness across every panel, and verify that the VIN stamped on the car matches the VIN on the title, the COA, and every service record. The output is a written report with photos — a document you either use to close the deal, renegotiate the price, or walk away.",
    "This guide covers exactly what a complete Porsche PPI includes, the model-specific additions that matter on air-cooled 964/993 and water-cooled 996/997 cars, how to choose a specialist shop (and how to avoid a general import mechanic who will miss the issues that matter), and how to translate the PPI report into a revised offer. It is the canonical MonzaHaus reference on the topic.",
  ],
  sections: [
    {
      heading: "What a complete Porsche PPI covers",
      body: [
        "A complete PPI is organized by system. Anything less than the full checklist is not a PPI — it is a courtesy look-over. Demand the full scope in writing before the shop puts the car on the lift.",
        "Engine — mechanical: compression test on all six cylinders with cylinder-to-cylinder variance recorded (target <10% spread); leak-down test expressed as percentage per cylinder (target <10%, flagging worn rings or valves above 15%); cold-start observation (first-start smoke, idle stability, lifter tick); borescope inspection of cylinder walls and valves through the spark plug bores — critical on M96/M97 for bore scoring on cylinder 6, and on air-cooled cars for valve condition.",
        "Engine — electronic: full diagnostic scan via PIWIS or Durametric, reading both current and stored fault codes, adaptation values, and readiness monitors. A freshly cleared DME is itself a red flag — readiness monitors taking a full drive cycle to re-set suggests the seller cleared codes immediately before inspection.",
        "Drivetrain and road test: road test across all gears (manual: verify clutch engagement point, no slip under load, shifter feel; PDK/Tiptronic: verify clean upshifts/downshifts and no shudder); listen for differential whine, CV joint clicks, wheel bearing rumble, and suspension knocks over bumps. Highway-speed stability and brake straight-line behavior are part of this.",
        "Body and paint: paint thickness gauge reading on every panel (OEM paint typically reads 120–180 microns; readings above 250 microns indicate repaint, above 400 microns indicate filler). Original paint carries a 15–25% value premium on collector-grade cars — verifying originality is arguably the single highest-dollar data point on the PPI. Panel gap measurement to identify prior accident repairs. Inspection of every shut-line, hood/deck-lid alignment, and door closure.",
        "Chassis and undercarriage: frame and chassis inspection for rust, impact damage, and weld repairs (especially jack points, front rails, and rear subframe mounts). Undercarriage inspection for oil leaks (front crank seal, rear main seal, cam cover gaskets), coolant leaks, suspension wear (control arm bushings, sway bar end links, shock integrity), and exhaust condition (header cracks on air-cooled cars, SAI tubes on 993, cat efficiency on water-cooled).",
        "Fluids and consumables: fluid condition check on engine oil, coolant, transmission/PDK fluid, and brake fluid. Optional paid extension: lab fluid analysis (Blackstone Labs, $35 per sample) to identify bearing-wear metals, coolant intrusion, or fuel dilution — strongly recommended on M96/M97 cars and on any high-mileage purchase.",
        "Identity and documentation: VIN verification at every stamped location — dashboard, A-pillar, engine bay stamp, and under-carpet chassis stamp. All four must match each other, the title, and (if a numbers-matching car) the Porsche Certificate of Authenticity (COA). Matching-numbers verification requires the COA in hand — cross-reference engine number, transmission number, color code, and options. Interior condition assessment: original Recaros, door cards, carpeting, headliner, dash (especially 964/993 dashtops for cracking). Documentation review: full service records, ownership chain, prior PPI reports if any, accident history via Carfax/AutoCheck, and COA.",
      ],
    },
    {
      heading: "Model-specific PPI additions",
      body: [
        "A Porsche-specialist PPI applies model-specific checks that a general import shop will not know to perform. These are the additions that separate a useful PPI from a generic pass/fail.",
        "964 (1989–1994): dual-mass flywheel condition (shake test, wear tolerance — replacement $2,500+); DME relay behavior (original unit fails, causing no-start); engine case leaks through-case (common and expensive — full top-end off to address); chain ramp condition on 1989–1990 cars (updated ramp is a mandatory buy-or-run check); dashtop cracking; A/C system (R12-to-R134a conversion status).",
        "993 (1995–1998): Secondary Air Injection (SAI) system function — failed SAI throws CEL and is expensive to correct properly ($2,000–$5,000 depending on approach); cylinder head stud corrosion (verify via borescope and leak patterns — full head stud replacement is engine-out work); hot-start issues (DME temp sensor, fuel pressure regulator); oil tank and thermostat function; 993 Turbo: boost leak test, wastegate function, turbo shaft play.",
        "996 / 997.1 Carrera (1999–2008): IMS bearing risk profile — see the MonzaHaus IMS Bearing guide for full protocol; Rear Main Seal (RMS) weep condition (common, not catastrophic, but factors into negotiation); plastic coolant pipes (996 Turbo especially — aluminum replacement is a known upgrade); AOS (Air-Oil Separator) function; cylinder-6 bore scoring via borescope (997.1 3.8L especially).",
        "997.1 DFI era / 997.2 (2009+): bore scoring risk continues on certain 9A1 production runs — borescope all six cylinders, not just cylinder 6; PDK software updates verified; DFI-specific carbon buildup on intake valves (walnut blast at ~60k miles is the accepted service); no IMS concern on 9A1 engines.",
        "997 Turbo / GT2 / GT3 / GT3 RS (Mezger): the Mezger engine itself is essentially bulletproof — but verify turbo condition on Turbo/GT2 (shaft play, boost leak test, oil return line condition), valve adjustment records on GT3/GT3 RS (Mezger GT cars require valve adjustment every 12,000 miles — absence of this in records is a deal-breaker), and coolant pipe upgrade status on pre-2006 Turbos.",
        "All turbo cars (any generation): boost leak test (pressurize the intake tract, identify leaks at couplers and intercoolers); oil temperature gauge behavior under load; wastegate and bypass valve function; charge-air cooler integrity; turbo oil return line condition (coking on older 996 Turbos is a known issue).",
      ],
    },
    {
      heading: "How to choose a Porsche PPI shop",
      body: [
        "The single most consequential choice in the PPI process is which shop performs the inspection. A Porsche-specialist shop will identify issues that a general import mechanic will not know exist. Do not use the seller's preferred shop — the shop should be independent, ideally located near the car's physical location (you are paying to avoid shipping a car for a PPI that reveals problems).",
        "Vetting criteria — a qualified Porsche PPI shop has: (1) PCA (Porsche Club of America) recommendation or active PCA technical involvement; (2) PIWIS or full Durametric diagnostic capability (not a generic OBD scanner); (3) borescope equipment for cylinder inspection; (4) experience on the specific generation you are buying — a shop that specializes in water-cooled cars is not automatically the right choice for a 964 PPI; (5) written PPI scope document they will provide in advance; (6) willingness to speak with you directly by phone about findings, not just email a form.",
        "Questions to ask when commissioning: What is your flat rate or hourly rate for a PPI on this generation? What is included in the base scope and what is optional? Do you include a borescope inspection? Can I see a sample PPI report from a car like this one? How long will the inspection take? When will the written report be delivered? Are you willing to take a phone call with me after you have the car on the lift?",
        "Finding specialists: PCA (Porsche Club of America) regional chapter recommendations — every chapter has a list of trusted shops; Rennlist and PelicanParts forum recommendations for the specific generation; marque-specialist shops such as (illustrative, not endorsed) TRG, European Collectibles, Auto Kennel, Canepa, Gaudin Porsche service department, independent Porsche specialists in every major metro. The MonzaHaus network maintains regional specialist recommendations for members.",
        "Red flags in a prospective PPI shop: refusal to provide a scope document in writing; flat-rate PPIs under $300 (incompatible with a proper inspection); no borescope equipment; no PIWIS or Durametric; unwillingness to speak directly with the buyer; any financial relationship with the seller or seller's broker.",
      ],
    },
    {
      heading: "How to use PPI results",
      body: [
        "The PPI report is the document that either closes, renegotiates, or ends the transaction. Read it the day it arrives, and read it twice. Call the technician — not just the service advisor — with any question. The best PPI reports include photographs of every issue identified.",
        "Acceptable findings (normal wear, no renegotiation required): minor RMS weep on a high-mileage water-cooled car; dashtop crack on a 964/993 (expected); single fault code for a historical condition that has cleared; standard suspension bushing wear on a 20+ year old car; a door ding or paint chip photographed in the listing; compression and leak-down within spec with <10% variance.",
        "Renegotiation findings (reduce offer by documented repair cost, or require seller to address pre-sale): failed SAI on a 993 ($2,000–$5,000); required valve adjustment overdue on a Mezger GT ($1,500–$3,000); dual-mass flywheel at end of service life on a 964 ($2,500+); un-retrofitted IMS on an M96/M97 with poor service history (15–25% discount per the IMS guide); RMS leak beyond weep (requires transmission-out work — $1,500–$3,000); deferred major service (IMS, clutch, water pump, spark plugs on water-cooled cars — $2,000–$6,000).",
        "Dealbreaker findings (walk away, or require substantial discount that the seller is unlikely to accept): evidence of prior accident damage undisclosed by seller (paint thickness +250 microns across multiple panels, welded frame repairs, airbag deployment history); VIN mismatch between stamped locations; COA does not match engine or transmission numbers on a car represented as matching-numbers; bore scoring on an M96/M97 — this is terminal absent a full engine rebuild; evidence of flood or salvage history; seller cannot or will not produce the COA on a car represented as numbers-matching at a collector price.",
        "The negotiation frame: do not approach the seller with a list of complaints — approach with a revised offer backed by the PPI report and specific repair quotes from the same specialist shop. \"The PPI identified X, Y, Z which I have quoted at $N from the inspecting shop. My revised offer reflects that cost.\" Sellers who refuse to engage with a documented PPI are selling to the wrong buyer — walk. There will be another car. There almost always is.",
      ],
    },
  ],
  howTo: {
    name: "How to commission a Porsche Pre-Purchase Inspection",
    description:
      "Step-by-step process for commissioning a professional PPI on any collector-value Porsche, from shop selection through acting on findings.",
    steps: [
      {
        name: "Identify a qualified Porsche-specialist shop near the car",
        text: "Use PCA (Porsche Club of America) regional chapter recommendations, Rennlist/PelicanParts forum threads for the specific generation, or the MonzaHaus network. The shop must be near the car's physical location — do not ship a car for a PPI that may fail. Verify PIWIS or Durametric capability, borescope equipment, and generation-specific experience.",
      },
      {
        name: "Confirm scope and cost in writing before scheduling",
        text: "Request a written PPI scope document. Expected cost: $500–$2,500 depending on generation and depth. Base scope should include compression, leak-down, borescope, diagnostic scan, paint thickness, road test, undercarriage, and written report with photos. Add-ons to consider: fluid analysis ($35/sample), longer road test, second-opinion borescope photographs.",
      },
      {
        name: "Schedule the inspection with the seller's cooperation",
        text: "The seller must agree to: (1) release the car to the independent shop for a half-day to full-day, (2) provide the COA if represented as numbers-matching, (3) provide full service records, and (4) disclose any known issues in advance. A seller who refuses any of these should be walked away from.",
      },
      {
        name: "Pay the shop directly — never through the seller",
        text: "The buyer pays the PPI shop directly. Never route payment through the seller or broker. The PPI shop's client is you, not the seller — and the report belongs to you. Typical payment: credit card at booking or on completion. Save the invoice.",
      },
      {
        name: "Attend in person if feasible; otherwise schedule a phone review",
        text: "Attending the PPI in person is ideal — you see the car on the lift and can ask the technician questions in real time. If travel is not feasible, schedule a 30-minute phone review with the technician (not the service advisor) on the day of inspection, and require written report with photographs within 48 hours.",
      },
      {
        name: "Read the full written report with photographs",
        text: "Expect a multi-page PDF with compression numbers, leak-down percentages, diagnostic scan output, paint thickness readings per panel, and annotated photos of any issues. If the report is one page without numerical data, it is not a PPI — request a refund and find another shop.",
      },
      {
        name: "Act on the findings — close, renegotiate, or walk",
        text: "Acceptable findings: close. Renegotiation findings: revise the offer with documented repair quotes from the inspecting shop. Dealbreaker findings (VIN mismatch, undisclosed accident, bore scoring, flood history, COA mismatch on a matching-numbers car): walk, and thank the PPI for saving you the mistake.",
        url: "https://www.pca.org",
      },
    ],
  },
  faqs: [
    {
      question: "How much does a Porsche PPI cost?",
      answer:
        "$500 to $2,500 depending on scope, generation, and shop location. A base PPI on a water-cooled 996/997 at a Porsche-specialist shop typically runs $500–$900. A comprehensive PPI on an air-cooled 964/993 or a Mezger GT car runs $1,000–$1,800. Full documentation-plus-inspection on a high-value collector car (early 911, Carrera GT, 918) runs $1,500–$2,500. Flat-rate PPIs under $300 are incompatible with a proper inspection — avoid them.",
    },
    {
      question: "How long does a Porsche PPI take?",
      answer:
        "Half a day for a straightforward water-cooled car (996/997/991). A full day for an air-cooled 964/993, for any Mezger GT car, or for a comprehensive numbers-matching verification on a collector 911. The written report with photographs typically arrives within 24–48 hours of the inspection. Rushed PPIs skipping the borescope or road test are not full PPIs — demand the full scope in writing before scheduling.",
    },
    {
      question: "Who pays for the Porsche PPI — buyer or seller?",
      answer:
        "The buyer pays. The PPI is commissioned by the buyer, paid for by the buyer, performed by a shop chosen by the buyer, and the resulting report belongs to the buyer. Paying through the seller or using the seller's preferred shop compromises independence. A seller who refuses to allow a buyer-commissioned PPI is signaling something — walk.",
    },
    {
      question: "Can I skip the PPI if I trust the seller?",
      answer:
        "No. Trust is not a substitute for a compression test. Sellers who are honest still do not know about bore scoring on their 997.1, head stud corrosion on their 993, or a VIN discrepancy introduced by a prior owner. Even on cars bought from close friends or long-time club members, a PPI protects both parties — the seller wants a clean transaction and no post-sale disputes. Skip the PPI on collector-value cars and you are self-insuring a six-figure bet on a vehicle you did not build.",
    },
    {
      question: "What should the PPI shop look for on a Porsche?",
      answer:
        "The full system-by-system checklist: compression and leak-down on all six cylinders, borescope of cylinder walls and valves, cold-start observation, PIWIS/Durametric diagnostic scan, road test across all gears, paint thickness gauge on every panel, panel gap and shut-line inspection, frame/chassis for rust and impact damage, undercarriage for leaks and suspension wear, fluid condition (optional lab analysis), VIN verification at every stamped location, COA cross-reference on matching-numbers cars, interior originality, and full documentation review. See the complete checklist in this article.",
    },
    {
      question: "Does a PPI guarantee the car is problem-free?",
      answer:
        "No. A PPI is a snapshot at a single point in time, performed by a specialist with a finite amount of time. It dramatically reduces risk on known failure modes and identity verification, but it does not guarantee the car will not have a bearing failure next week or a seal leak next year. The PPI's value is in identifying existing and near-term issues, verifying originality, and establishing that the car is what the seller represents. It shifts risk from near-certainty of at least one expensive surprise to a calibrated, documented risk profile.",
    },
    {
      question: "Can a Porsche PPI be done remotely?",
      answer:
        "Yes, if the buyer is not local — but the PPI shop must still physically have the car in person for a half-day to full-day. \"Remote\" means the buyer does not attend; it does not mean a video walkaround. A legitimate remote PPI includes the same scope (compression, leak-down, borescope, scan, paint thickness, road test, report with photos) and typically adds a phone review with the technician. Do not accept a video-only PPI — it is not a PPI.",
    },
    {
      question: "Should I attend the PPI in person?",
      answer:
        "Ideal if feasible. Attending means you see the car on the lift, watch the compression test, look through the borescope yourself, and can ask the technician direct questions. It also lets you form a direct relationship with the shop if you decide to buy the car and want them as your future service provider. If you cannot travel, a 30-minute phone call with the technician on the day of inspection, plus a detailed written report with photographs within 48 hours, is an acceptable substitute.",
    },
    {
      question: "What if the PPI finds major issues?",
      answer:
        "Three options: (1) walk away — this is the right call on VIN mismatches, undisclosed accident damage, bore scoring, flood history, or COA mismatch on a matching-numbers car; (2) renegotiate — present the seller with a revised offer backed by repair quotes from the inspecting shop; (3) require the seller to address the issues pre-sale through the same specialist shop, with receipts. Sellers who refuse to engage with documented PPI findings are selling to the wrong buyer. There will be another car.",
    },
    {
      question: "How do I find a Porsche-specialist PPI shop?",
      answer:
        "PCA (Porsche Club of America) regional chapter recommendations are the gold standard — every chapter maintains a list of trusted independent specialists. Rennlist and PelicanParts forum threads for your specific generation (964, 993, 996, etc.) surface long-running shops with documented reputations. The MonzaHaus network maintains regional specialist recommendations for members. Verify PIWIS or Durametric capability, borescope equipment, and generation-specific experience — a water-cooled specialist is not automatically the right choice for a 964 PPI.",
    },
  ],
  verdict:
    "A Pre-Purchase Inspection is the single most cost-effective piece of due diligence in collector Porsche ownership. For $500–$2,500 against a six-figure transaction, a Porsche-specialist shop will verify identity, measure mechanical condition, confirm originality, and document every finding in writing. Skipping the PPI to save a thousand dollars on a $100,000 car is not thrift — it is the most expensive decision a Porsche buyer can make. The right frame is simple: the PPI is not a cost of the transaction, it is the cost of being the buyer who pays a fair price for the car that was actually represented, rather than the buyer who discovers the difference after the title transfers.",
  keywords: [
    "Porsche PPI",
    "Porsche pre-purchase inspection",
    "Porsche PPI cost",
    "Porsche PPI checklist",
    "how to inspect a Porsche",
    "Porsche compression test",
    "Porsche leak-down test",
    "Porsche borescope inspection",
    "Porsche paint thickness gauge",
    "Porsche VIN verification",
    "Porsche specialist shop",
    "PCA recommended shop",
  ],
};
