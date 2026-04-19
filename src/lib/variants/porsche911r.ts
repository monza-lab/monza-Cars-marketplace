import type { PorscheVariantPage } from "./types";

export const porsche911r: PorscheVariantPage = {
  slug: "991-r",
  shortName: "911 R",
  fullName: "Porsche 911 R (991)",
  parentModelSlug: "991",
  tagline: "The purist 991 — GT3 RS engine, manual-only, minimal aero.",
  intro: [
    "The 911 R was Porsche's 2016 answer to the purist backlash against a PDK-only 991.1 GT3. Built in exactly 991 units globally — a production number chosen to echo the model code — it paired the naturally aspirated 4.0L flat-six from the 991.1 GT3 RS with a six-speed manual gearbox, a stripped interior, and a deliberately understated body free of the GT3 RS wing and aero furniture.",
    "Mechanically the R sits between the 991.1 GT3 and GT3 RS. Engine (500 hp, 338 lb-ft), brakes, and suspension hardware are carried over from the RS, while the body returns to the narrower GT3 silhouette and the cabin is trimmed back — no rear seats, lightweight door cards with fabric pulls, optional single-mass flywheel, and houndstooth-cloth bucket seats as a nostalgic nod to the 1967 911 R. The result is the lightest 991-era 911 GT product at roughly 1,370 kg.",
    "The R was Porsche's clearest admission that a customer segment still wanted a no-compromise, three-pedal, naturally aspirated 911. It is also the variant that produced the wildest dealer-markup speculation cycle the modern 911 market has seen — MSRPs near $185k in 2016 were trading hands for $600k–$800k within months of delivery. The market has since stabilized, but clean cars remain firmly in the $500k–$900k+ band and the R is now treated as the canonical modern unicorn manual.",
  ],
  yearRange: "2016",
  production: "Exactly 991 units globally — production number deliberately matches model code",
  significance: [
    "The 911 R is the bridge between the 997.2 GT3 RS 4.0 and the later 991.2 GT3 Touring. It is the car that reopened the internal debate at Porsche about offering manual gearboxes in GT products, and it is the direct reason the 991.2 GT3 was offered with a six-speed manual and the Touring package was introduced in 2017. Without the R, the modern GT3 Touring line does not exist.",
    "It is also one of the clearest case studies in modern-Porsche speculation. Allocation was discretionary and heavily weighted to existing GT customers, secondary market pricing detached from MSRP within weeks, and the car became the reference point for how Porsche would handle future limited allocations (Speedster, Sport Classic, S/T). Among purists, the 500 hp NA flat-six and fixed manual-only spec place it at or near the top of the modern 911 collector hierarchy.",
  ],
  specs: [
    { label: "Engine", value: "4.0L naturally aspirated flat-six (shared with 991.1 GT3 RS)" },
    { label: "Power", value: "500 hp @ 8,250 rpm" },
    { label: "Torque", value: "338 lb-ft @ 6,250 rpm" },
    { label: "Transmission", value: "6-speed manual — no PDK option" },
    { label: "Drive", value: "Rear-wheel drive with rear-axle steering" },
    { label: "Weight", value: "≈1,370 kg (3,020 lb) — lightest 991-era GT product" },
    { label: "0–100 km/h (0–62 mph)", value: "3.8 s" },
    { label: "Top speed", value: "323 km/h (201 mph)" },
    { label: "Suspension", value: "GT3 RS-derived, manually adjustable front/rear" },
    { label: "Brakes", value: "Steel standard; Porsche Ceramic Composite Brakes (PCCB) optional" },
    { label: "Wheels/Tyres", value: "20-inch centre-lock forged alloys — 245/35 front, 305/30 rear Michelin Pilot Sport Cup 2" },
  ],
  identifiers: [
    { label: "VIN pattern", value: "WP0AF2A90GS19XXXX — G for 2016 model year" },
    { label: "Engine code", value: "MA1.75 (4.0L NA shared with 991.1 GT3 RS)" },
    { label: "Body", value: "Narrow GT3 shell — no RS wing, lightweight magnesium roof, carbon fibre front fenders and hood" },
    { label: "Interior", value: "Houndstooth-cloth buckets, no rear seats, fabric door pulls, R-specific shift knob with wood insert option" },
    { label: "Exterior cues", value: "Twin red or green longitudinal stripes (optional), classic 'R' script on rear deck, no fixed rear wing (pop-up deployable wing only)" },
    { label: "Option codes", value: "Single-mass flywheel (sport), Chrono Package, front-axle lift, PCCB, stripe delete — all factory options documented on build sticker" },
  ],
  priceBands: [
    { label: "Driver-grade, higher miles", range: "$500k–$600k", note: "5,000–15,000 km, original paint, full service history; entry point into the R" },
    { label: "Excellent, low miles", range: "$600k–$750k", note: "Under 5,000 km, documented history, desirable spec (stripes, PCCB, single-mass flywheel)" },
    { label: "Delivery-mile concours", range: "$750k–$900k+", note: "Sub-1,000 km, first owner, unregistered or near-unregistered" },
    { label: "Special spec / significant PO", range: "$800k–$1M+", note: "Notable original-owner provenance or rare factory colour-to-sample" },
  ],
  faqs: [
    {
      question: "How many Porsche 911 R were made?",
      answer:
        "Exactly 991 units globally, produced in 2016 only. The production number was deliberately chosen to match the 991 model code — a practice Porsche has since repeated with the 992 Sport Classic (1,250) and 992 S/T (1,963). Allocation was discretionary and heavily skewed toward existing Porsche GT customers.",
    },
    {
      question: "Was the 911 R available with PDK?",
      answer:
        "No. The 911 R was manual-only — a deliberate positioning decision after the 991.1 GT3 and GT3 RS were offered exclusively with PDK. The entire point of the R was to give purist customers a naturally aspirated, six-speed-manual, narrow-body 911 with GT3 RS mechanicals. Any listing showing a PDK 911 R is either a mis-advertised 991.2 GT3 Touring or not authentic.",
    },
    {
      question: "What is the difference between the 911 R and the 991.2 GT3 Touring?",
      answer:
        "The 991.2 GT3 Touring (2017–2019) was Porsche's direct response to the R's demand — it democratized the concept by offering the GT3's 4.0L engine with a six-speed manual in a similarly understated, wingless body. Key differences: the Touring uses the 991.2 GT3 engine (500 hp but different internal architecture), it was produced in much higher numbers (no hard cap), and it retains GT3 suspension geometry rather than RS-derived. The R is rarer (991 units), uses the 991.1 GT3 RS engine and hardware, and trades at roughly 3–5x Touring money.",
    },
    {
      question: "Is the 991 R the same as the original 1967 911 R?",
      answer:
        "No. The 1967 911 R was a racing homologation special produced in about 20 units with a 210 hp 2.0L engine, extensive weight reduction, and a competition focus. The 2016 991 R is a modern limited-edition road car that borrows the R nameplate as a tribute. The houndstooth seat fabric and red/green stripe option on the 991 R are direct visual references to the 1967 original. They share a philosophy — lightweight, manual, purist — but no mechanical parts.",
    },
    {
      question: "Why is the production number exactly 991?",
      answer:
        "Porsche deliberately matched production volume to the 991 model code — a marketing and collector-signalling choice. It established the template now followed by other Heritage Design and limited GT products (992 Sport Classic = 1,250 referencing the 992 + 25 heritage offset; 992 S/T = 1,963 referencing the year of the original 911). The 991 count creates guaranteed scarcity and makes authentication easier — every chassis has a documented allocation record at Porsche.",
    },
    {
      question: "What happened to 911 R prices after launch?",
      answer:
        "MSRP in the US was approximately $185,000. Within weeks of first deliveries in mid-2016, dealers were flipping allocations at $400k–$500k, and by end of 2016 auction and private-sale trades were hitting $600k–$800k. Prices peaked in 2017–2018 and partially corrected through 2019–2021 as the 991.2 GT3 Touring reached the market. Since 2022 the R has stabilized in the $500k–$900k band depending on spec, mileage, and provenance. The R is now considered past its speculation peak and into established collector territory.",
    },
    {
      question: "Is the 911 R a good investment in 2026?",
      answer:
        "The R is established collector stock, not a speculation play. Values have compounded or held since the 2019–2021 correction and the floor has proven resilient. Low-mileage, original-owner cars in desirable spec continue to trade at premiums. Aggressive further appreciation is unlikely from current levels — the R now behaves like a blue-chip modern 911, similar to a 997 GT3 RS 4.0 or 964 RS. It is a hold-and-preserve asset rather than a growth trade.",
    },
    {
      question: "What components are shared with the 991.2 GT3 Touring?",
      answer:
        "The Touring package concept — wingless rear deck with a deployable pop-up spoiler, narrower body, and understated aesthetic — originated with the R. The Touring inherits the R's visual language but uses the later 991.2 GT3 engine and gearbox architecture. The houndstooth interior trim and leather-and-Alcantara combinations offered on the Touring are also direct R references. Mechanically the cars are related but not shared — the R uses 991.1 GT3 RS hardware, the Touring uses 991.2 GT3 hardware.",
    },
    {
      question: "What tyres and brakes does the 911 R use?",
      answer:
        "Standard brakes are six-piston front / four-piston rear steel with 380mm front / 380mm rear discs, shared with the 991.1 GT3 RS. PCCB (Porsche Ceramic Composite Brakes) was a factory option — roughly 60–70% of R cars were ordered with PCCB based on documented build sheets. Wheels are 20-inch forged centre-lock, magnesium-look, fitted with Michelin Pilot Sport Cup 2 in 245/35 front and 305/30 rear. Replacement tyres should match the N-rated Cup 2 spec to preserve spec originality.",
    },
    {
      question: "What should I check on a 911 R pre-purchase inspection?",
      answer:
        "Confirm matching-numbers engine and transmission, Porsche build sticker option codes, service history (Porsche-dealer or recognized independent specialist only), original wheels and centre-lock hardware condition, PCCB wear percentage if equipped (replacement cost approaches $30k), any evidence of track use (brake rotor thermal signatures, suspension setting logs), and paint originality via electronic paint-depth gauge. For R cars with stripe option, verify factory application — aftermarket stripe addition reduces value. A Porsche Certificate of Authenticity should be available.",
    },
  ],
  buyerConsiderations: [
    "Mileage is scrutinized more tightly than on almost any other modern 911 — each 1,000 km materially affects value, especially above 10,000 km.",
    "Factory spec matters: stripes, single-mass flywheel, PCCB, chrono, and front-axle lift are the premium build sheet items. Stripe-delete cars are rarer but mixed reception in the market.",
    "Original-owner documentation is a meaningful price lever — cars with a known single-owner history from delivery trade at ~10-15% over equivalent multi-owner cars.",
    "PCCB replacement economics are real — worn ceramic rotors can cost $25k–$30k to replace, and this should be factored into any purchase where pads are near-worn.",
    "Title history must be clean — any accident or repaint history reduces value disproportionately versus other GT products because the R buyer base prioritizes originality.",
    "The R is not a Porsche Classic-supported car yet (too new), so parts availability and service go through standard Porsche Motorsport channels. Budget for specialist service over dealer service.",
  ],
  thesis:
    "The 911 R is established modern-collector blue-chip. It survived its speculation cycle, corrected, and re-based in the $500k–$900k range where it has held for multiple years. With only 991 units globally, a manual-only spec that Porsche will not repeat on the 991 platform, and a direct bloodline into the Touring and S/T lineage, the R is defensible as a preserve-of-wealth position. Aggressive further appreciation is unlikely from current levels; the investment case is scarcity, documented heritage, and resistance to drawdown rather than growth.",
  keywords: [
    "Porsche 911 R",
    "991 R",
    "911 R for sale",
    "911 R manual",
    "911 R production number",
    "911 R vs GT3 Touring",
    "Porsche 911 R price 2026",
    "991 R investment",
    "Porsche unicorn manual",
    "911 R houndstooth",
    "991.1 GT3 RS engine",
    "911 R 4.0 naturally aspirated",
  ],
};
