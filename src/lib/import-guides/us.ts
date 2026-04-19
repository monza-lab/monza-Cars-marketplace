import type { ImportGuide } from "./types";

export const usImportGuide: ImportGuide = {
  slug: "us",
  country: "United States",
  tagline: "The 25-year rule, Show-and-Display, and everything buyers need to know.",
  title: "How to Import a Porsche to the United States — 25-Year Rule, EPA, DOT | MonzaHaus",
  intro: [
    "Importing a Porsche to the United States is governed by two federal agencies — the National Highway Traffic Safety Administration (NHTSA, under DOT) and the Environmental Protection Agency (EPA) — plus Customs and Border Protection (CBP) on the logistics side. The framework hinges on one critical threshold: the vehicle's age.",
    "Cars 25 years old or older (by month of manufacture) are exempt from NHTSA's Federal Motor Vehicle Safety Standards (FMVSS) and, if they're also 21+ years old, from EPA emissions certification requirements. This makes the 25-year rule the single most important fact in any US Porsche import scenario. A 1995 Porsche 993 Carrera RS becomes freely importable on its 25th birthday — month-to-month, not calendar year.",
    "Cars newer than 25 years are effectively un-importable unless they qualify under a narrow 'Show and Display' exemption (NHTSA-approved, limited-mileage, pre-approval required) or are one of a small number of models federalized by a Registered Importer (RI) at considerable cost. For collector Porsches in practice, the 25-year rule is the realistic path.",
    "This guide walks the full process for a 25-year-old-plus Porsche — the most common scenario — including CBP paperwork, EPA Form 3520-1, DOT HS-7, Customs broker considerations, and state-level registration requirements that vary meaningfully by state.",
  ],
  regulatoryContext: [
    "Federal: NHTSA (FMVSS compliance — waived at 25+ years), EPA (emissions — waived at 21+ years), CBP (duty + entry). State-level: title, registration, emissions inspection (varies by state — California, for example, exempts pre-1976 from biennial smog but requires 'direct import' paperwork for all imports).",
    "The 25-year threshold is measured from month of manufacture, not model year. A Porsche 964 built in October 1990 becomes importable October 2015, not January 2015. Build date is verified via the factory build plate or Porsche Certificate of Authenticity (COA).",
    "Duty is 2.5% of declared value for passenger cars, paid to CBP at port of entry. There is no separate 'luxury tax' on imports at the federal level. State sales tax and registration fees are assessed upon titling.",
  ],
  steps: [
    {
      name: "Confirm the Porsche is 25+ years old by month of manufacture",
      text: "Request a Porsche Certificate of Authenticity (COA) from Porsche Classic (~$150). The COA states the exact build month — the ONLY proof CBP will accept. Model year on the title is not sufficient; build month is what matters for the 25-year exemption.",
    },
    {
      name: "Find the car and agree commercial terms",
      text: "Most collector Porsche imports to the US come from Germany, UK, or Japan. Engage a European or Japanese seller with documented history. Budget shipping as a separate line item; request pre-purchase inspection before wiring funds.",
    },
    {
      name: "Arrange shipping (RoRo or container)",
      text: "Container shipping ($2,500–$4,500 from EU, $3,500–$5,500 from Japan) is strongly preferred for collector cars over RoRo ($1,500–$2,500). Container adds insurance, weather protection, and reduces theft/damage risk materially. Typical transit: 4–6 weeks EU→US; 3–5 weeks Japan→US West Coast.",
    },
    {
      name: "Prepare required CBP documentation",
      text: "You need: original foreign title, commercial invoice/bill of sale, EPA Form 3520-1 (declare exemption — 'Box E' for pre-1976 or 'Box G' for 21+ year conversion), and DOT Form HS-7 (declare exemption — 'Box 1' for 25+ year FMVSS exemption). All forms available free from EPA/NHTSA websites.",
      url: "https://www.cbp.gov/trade/basic-import-export/vehicle-imports",
    },
    {
      name: "Clear CBP at port of entry",
      text: "Use a licensed customs broker for $300–$500 — they file the Entry Summary (Form 3461), pay 2.5% duty on declared value, and coordinate release. DIY is possible but slows the process significantly. West Coast ports (LA/Long Beach) handle most Japan imports; East Coast (Baltimore, NY) handles most EU imports.",
    },
    {
      name: "Post-entry: EPA/DOT compliance check",
      text: "For 25+ year vehicles, EPA and DOT rely on the exemption declarations — no physical inspection is required. Retain the stamped HS-7 and 3520-1 forms permanently; your state DMV may request them at titling.",
    },
    {
      name: "State titling and registration",
      text: "Take the original foreign title, CBP release documents (Form 7501), EPA/DOT stamped forms, and any state-specific safety/emissions inspection results to the DMV. California requires the Bureau of Automotive Repair (BAR) 'Direct Import Application'. Most other states process as a regular title transfer. Classic plate categories (historical, antique) may have usage restrictions but reduced fees.",
    },
  ],
  costs: [
    { label: "Purchase price", estimate: "Varies", note: "Wire to seller or escrow" },
    { label: "European export prep (title, transport to port)", estimate: "$300–$800" },
    { label: "Container shipping (EU → US)", estimate: "$2,500–$4,500", note: "Per 20ft container; collector cars usually solo in a 20ft" },
    { label: "Shipping insurance", estimate: "1.25–2% of value", note: "Required for high-value cars — claim settlement depends on documented condition" },
    { label: "US port charges (demurrage, handling)", estimate: "$200–$500" },
    { label: "Customs duty", estimate: "2.5% of declared value", note: "Federal. Declared value = commercial invoice amount" },
    { label: "Customs broker fee", estimate: "$300–$500" },
    { label: "Domestic US transport (port to garage)", estimate: "$500–$2,000", note: "Enclosed transport recommended for collector cars" },
    { label: "State sales tax + registration", estimate: "Varies by state, typically 5–10% of value" },
  ],
  pitfalls: [
    "Buying a car that is 24+11 months old — CBP will deny entry if even one month short of 25 years. Wait the extra month rather than shipping early.",
    "Accepting 'model year' as build date. The factory build plate month is what CBP checks. A '1995' 993 could be built late 1994 or early 1996 — always verify via COA.",
    "Relying on the seller's export broker for US-side forms. US CBP requires US-based filing; use a US customs broker.",
    "Underdeclaring value to reduce duty. CBP does check comparable auction results; declared value materially below market triggers a reassessment plus penalties.",
    "Shipping without independent pre-purchase inspection. Damage discovered in the US after clearance is expensive and difficult to resolve with an overseas seller.",
    "California and Massachusetts have stricter 'direct import' paperwork than other states. Budget extra time if titling in those jurisdictions.",
    "Some US states will not title Euro-market cars with Euro-market odometer readings in km/h — verify your state's policy before shipping.",
  ],
  timeline:
    "End-to-end, a typical EU → US Porsche import takes 10–14 weeks from purchase agreement: 2 weeks for European export prep, 4–6 weeks ocean transit, 1–2 weeks port handling and CBP clearance, 2–4 weeks for domestic transport and state titling.",
  faqs: [
    {
      question: "What is the 25-year rule for importing cars to the US?",
      answer:
        "The 25-year rule (NHTSA exemption for FMVSS compliance) allows any vehicle 25 or more years old at time of import to enter the US without meeting federal motor vehicle safety standards. Combined with EPA's 21-year emissions exemption, this makes 25-year-old cars freely importable subject only to CBP duty (2.5%) and state titling. It is measured from month of manufacture, not model year.",
    },
    {
      question: "How much does it cost to import a Porsche to the US?",
      answer:
        "Typical all-in cost is 3.5%–7% of the purchase price, above the purchase price itself. For a $200,000 993 Carrera from Germany: ≈$3,000–$4,000 shipping + insurance, $5,000 duty (2.5%), $500 broker, $1,000 domestic transport, $10,000–$20,000 state sales tax depending on state. Roughly $20,000–$30,000 all-in for a mid-value import.",
    },
    {
      question: "Can I import a Porsche less than 25 years old to the US?",
      answer:
        "Only under narrow exceptions. The Show and Display program (NHTSA-approved list) allows limited-mileage import of select exotic or historically-significant vehicles — but the approved list is small and Porsche-only candidates are rare. Alternatively, a Registered Importer (RI) can federalize the car at $50,000–$150,000+ in modifications. For nearly all collector Porsches under 25 years, the practical advice is to wait until the car turns 25.",
    },
    {
      question: "What is Show and Display and does it apply to Porsche?",
      answer:
        "Show and Display is NHTSA's program for importing rare vehicles (under 500 US units, of significant technological/historical value) with a 2,500-mile-per-year driving limit. A handful of Porsches have been approved — notably the 959 (Bill Gates spearheaded its inclusion), Carrera GT, 918 Spyder, and select unique race-car-derived specials. Most collector Porsches are NOT on the list and cannot use this pathway.",
    },
    {
      question: "Do I need a customs broker to import a Porsche?",
      answer:
        "Technically no — CBP allows self-filing. In practice, yes. A licensed broker ($300–$500) handles Entry Summary filing, duty payment, and port logistics. DIY extends clearance time by days to weeks and increases error risk. For collector-value vehicles, the broker fee is rounding error relative to the cost of a missed document or delayed release.",
    },
    {
      question: "Which US ports are best for Porsche imports?",
      answer:
        "From Europe: Baltimore (MD) and Newark (NJ) are standard. Port of Charleston (SC) and Savannah (GA) are lower-volume and faster. From Japan: Long Beach / Los Angeles for most imports; Tacoma (WA) for Pacific Northwest delivery. Choose the port closest to final destination to minimize domestic transport cost.",
    },
    {
      question: "Can California register an imported Porsche?",
      answer:
        "Yes, but with extra steps. California requires the Bureau of Automotive Repair 'Direct Import Application' (Form BAR 1002), proof of CBP entry, and a 'Brake and Light' inspection at a BAR-licensed shop. Vehicles 1976 and newer need a BAR Referee emissions inspection. Pre-1976 Porsches are exempt from biennial smog but still require the direct-import paperwork. California titling of a Euro Porsche typically adds 4–8 weeks vs the national median.",
    },
    {
      question: "Is it cheaper to import a Porsche from Japan or from Germany?",
      answer:
        "Japan is typically cheaper on the shipping line ($3,500–$4,500 vs $3,000–$4,500 from Germany to US West Coast vs East Coast routing). Japanese Porsches often come with meticulous maintenance records but are overwhelmingly right-hand-drive, which reduces US market value by 20–40%. German-market left-hand-drive cars command a premium and are closer to US market expectations. Choose market based on target spec, not shipping cost alone.",
    },
    {
      question: "Do I pay US sales tax when importing a Porsche?",
      answer:
        "Yes — state sales tax is assessed at titling, not at import. Rate varies by state (0% in Montana/Oregon/New Hampshire/Delaware, 6–10.25% in most others, based on declared or fair-market value). Imported vehicles are not exempt. Some buyers use Montana LLC registration to avoid state sales tax — this has tax and insurance implications and is not legal advice. Consult a tax professional.",
    },
    {
      question: "What paperwork do I need to keep after importing a Porsche?",
      answer:
        "Keep permanently: original foreign title (surrendered to state DMV at titling, but keep certified copies), CBP Form 7501 Entry Summary, EPA Form 3520-1 (stamped), DOT Form HS-7 (stamped), commercial invoice/bill of sale, shipping bill of lading, and Porsche COA. At resale, these documents are worth 5–10% of car value — they prove legal import and protect the buyer.",
    },
  ],
  keywords: [
    "import Porsche to USA",
    "25 year rule Porsche",
    "Porsche 25 year import",
    "Porsche US import guide",
    "EPA Form 3520-1 Porsche",
    "DOT HS-7 Porsche",
    "import Porsche from Germany to USA",
    "import Porsche from Japan",
    "Porsche Show and Display",
    "US customs Porsche",
    "Porsche federalization",
    "import classic Porsche USA",
  ],
};
