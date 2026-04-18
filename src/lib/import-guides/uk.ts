import type { ImportGuide } from "./types";

export const ukImportGuide: ImportGuide = {
  slug: "uk",
  country: "United Kingdom",
  tagline: "Post-Brexit Porsche imports — NOVA, IVA, V5C, and the 5% reduced VAT rate for historics.",
  title: "How to Import a Porsche to the UK — Post-Brexit NOVA, IVA, V5C Guide | MonzaHaus",
  intro: [
    "Since 1 January 2021, the United Kingdom has been outside the EU customs union, and Porsche imports into Great Britain have changed materially. Cars coming from Germany, Italy, the Netherlands, or any other EU member state are now treated as third-country imports: customs paperwork, VAT, and potentially import duty are all assessed at the UK border. The end of free movement has added cost, time, and complexity to every cross-Channel collector-car transaction.",
    "That said, two factors soften the impact for collector Porsches. First, the UK-EU Trade and Cooperation Agreement (TCA) allows a 0% preferential duty rate on vehicles that meet the rules-of-origin threshold — which most EU-built Porsches do when shipped directly from an EU seller with the correct origin declaration. Second, HMRC applies a reduced VAT rate of 5% (rather than the standard 20%) on imports of vehicles 30+ years old that are 'of historical interest' — a category that almost every collector Porsche satisfies.",
    "DVLA registration follows the standard V5C process, with two specific pathways depending on the car's type approval history. Cars with an existing EU type approval (CoC) can register directly via NOVA (Notification of Vehicle Arrival) within 14 days of entry. Cars without EU type approval — typically US-market or Japanese-domestic-market Porsches — require Individual Vehicle Approval (IVA) at a DVSA test centre, which adds cost and weeks to the timeline.",
    "This guide covers the full post-Brexit import path for a collector Porsche into the UK, including port selection, NOVA vs IVA decisioning, HMRC's reduced VAT rate application, DVLA V5C registration, MOT exemption for 30+ year vehicles, and the practical realities of left-hand-drive vs right-hand-drive Porsches in the UK market. Post-Brexit rules continue to evolve; consult HMRC, DVLA guidance, and a UK customs broker before finalising a purchase.",
  ],
  regulatoryContext: [
    "National authorities: HMRC (customs, duty, VAT), DVLA (registration and V5C logbook, based in Swansea), DVSA (vehicle testing and IVA), and individual UK ports for physical clearance. Rules are set by the Taxation (Cross-border Trade) Act 2018 and the UK-EU TCA (2021).",
    "Customs regime. Imports from outside the UK: 10% duty on passenger cars from non-preferential origins, 0% duty under the UK-EU TCA if rules of origin are met (typically requiring an EUR.1 certificate or supplier's origin declaration), 20% standard VAT OR 5% reduced VAT for vehicles 30+ years old 'of historical interest' that are in substantially original condition (HMRC Notice 362). The reduced-rate qualification requires application to HMRC at the time of entry — retroactive reclaim is rare.",
    "Registration regime. The DVLA V5C logbook is the UK's vehicle title. Imported cars register via the NOVA service — HMRC generates a NOVA reference within 14 days of entry, which DVLA requires before issuing a V5C. Cars 40+ years old receive automatic MOT exemption (rolling 40-year threshold) and, upon owner application, Vehicle Excise Duty (road tax) exemption under the historic vehicle tax class. Left-hand-drive Porsches are fully legal to register and drive in the UK.",
  ],
  steps: [
    {
      name: "Confirm origin, age, and target classification",
      text: "Verify the car's country of current registration (EU vs non-EU), its date of first registration (for 30-year 5% VAT and 40-year MOT-exemption thresholds), and whether it has an EU CoC on file with Porsche Classic. These three facts drive the entire cost and paperwork path. For 30+ year cars, confirm originality — HMRC's 5% reduced rate requires the car be 'of historical interest' and substantially as produced.",
    },
    {
      name: "Pre-purchase inspection and commercial terms",
      text: "Engage an independent UK or EU Porsche specialist for PPI before wiring funds. Request the Porsche Certificate (£200–£400 via Porsche Classic) to confirm matching numbers, factory build spec, and originality — all three matter for HMRC's 5% VAT qualification as well as resale. For non-EU sourced cars (US, Japan, Switzerland), document the export paperwork trail before shipping.",
    },
    {
      name: "Arrange shipping — EU port transit or direct sea freight",
      text: "From EU: road transport via Rotterdam/Zeebrugge/Calais then ferry or Eurotunnel to Dover, Sheerness, or Purfleet (£1,000–£2,000 all-in). Post-Brexit, both sides require customs paperwork — use a broker. From US: container to Southampton, Grimsby, or Felixstowe, 4–6 weeks, £2,200–£3,800. From Japan: container to Southampton or Tilbury, 6–8 weeks, £3,000–£4,500. Container shipping is strongly recommended for collector cars.",
    },
    {
      name: "Port clearance and customs declaration",
      text: "A UK customs broker files the import declaration on CHIEF/CDS, declaring: commodity code 8703 (passenger cars), customs value (invoice + freight + insurance), origin (for TCA 0% duty claim), and VAT rate (20% standard or 5% reduced for 30+ year historics). Broker fees: £250–£500. Retain the C79 VAT certificate — it is the proof HMRC issues for VAT paid on import.",
      url: "https://www.gov.uk/importing-vehicles-into-the-uk",
    },
    {
      name: "Apply for HMRC 5% reduced VAT rate (30+ year cars only)",
      text: "If the car is 30+ years old, substantially original, and of historical interest, file for reduced VAT at the time of customs entry. HMRC's threshold is the car itself plus limited period-correct restoration; heavily modified or restomod'd cars are ineligible. The broker files Notice 362 paperwork with supporting documentation (Porsche Certificate, period photos, auction comparables). Saving: 15 percentage points of VAT — on a £150,000 car, that is £22,500.",
    },
    {
      name: "File NOVA (Notification of Vehicle Arrival)",
      text: "Within 14 days of UK entry, file NOVA via the HMRC online portal. NOVA confirms VAT status and generates a reference number that DVLA requires for V5C issuance. Missed the 14-day window: HMRC can assess penalties and DVLA will refuse registration. For self-imports, the owner can file; for broker-handled imports, the broker files automatically.",
      url: "https://www.gov.uk/nova-register-vehicle-arrival",
    },
    {
      name: "Individual Vehicle Approval (IVA) if no EU CoC",
      text: "Cars without EU/UK type approval — typically US-market and Japanese-domestic-market Porsches — require IVA inspection at a DVSA test centre. IVA assesses structural, lighting, and emissions compliance. Cost: £450–£600 for the test, plus any conversion work (UK/EU headlight pattern, rear fog lamp, mph speedometer). Budget 4–8 weeks of lead time for a test slot. Cars 40+ years old can apply for the simplified Basic IVA pathway. EU-sourced Porsches with valid CoC skip this step entirely.",
    },
    {
      name: "Register with DVLA and obtain V5C logbook",
      text: "Submit to DVLA (via post to Swansea): V55/5 application form, original foreign title (surrendered), NOVA confirmation, C79 VAT certificate, CoC or IVA certificate, MOT certificate (waived for 40+ year cars), insurance certificate, and £55 first-registration fee + 6/12 months VED. DVLA issues the V5C logbook (2–6 weeks by post) and assigns a UK registration number. For 40+ year cars, apply for 'historic vehicle' tax class — VED drops to £0.",
    },
  ],
  costs: [
    { label: "Purchase price", estimate: "Varies", note: "Transfer via SWIFT or escrow" },
    { label: "Export prep (seller, transport to port)", estimate: "£300–£800" },
    { label: "EU road transport + Channel crossing (via Calais/Rotterdam)", estimate: "£1,000–£2,000", note: "For EU-sourced cars" },
    { label: "Container shipping (US → UK)", estimate: "£2,200–£3,800", note: "4–6 weeks to Southampton or Felixstowe" },
    { label: "Shipping insurance", estimate: "1.25–2% of value" },
    { label: "UK customs duty", estimate: "0% (TCA origin) or 10% (other origin)", note: "On customs value (invoice + freight + insurance)" },
    { label: "UK VAT (standard rate)", estimate: "20%", note: "On (customs value + duty)" },
    { label: "UK VAT (reduced rate, 30+ year historic)", estimate: "5%", note: "Subject to HMRC qualification under Notice 362" },
    { label: "Customs broker fee", estimate: "£250–£500" },
    { label: "IVA test fee (if required)", estimate: "£450–£600", note: "Plus conversion work — £1,500–£5,000 for US-spec cars" },
    { label: "DVLA first registration + VED", estimate: "£55 + VED (£0 for 40+ year historic)" },
    { label: "Domestic UK transport (port to garage)", estimate: "£200–£600" },
  ],
  pitfalls: [
    "Missing the 14-day NOVA deadline. HMRC assesses penalties and DVLA will not process V5C issuance. File immediately upon port release.",
    "Failing to claim 5% reduced VAT at the point of import. HMRC rarely grants retroactive reclassification. For any 30+ year Porsche, have the broker file Notice 362 paperwork at customs entry — not afterwards.",
    "Assuming EU origin still means duty-free post-Brexit. EU-origin cars are only 0% duty if the shipper files the correct origin declaration (EUR.1 or supplier's declaration under the TCA). Without it, HMRC charges the full 10%.",
    "Buying a restomod or heavily modified 30+ year Porsche and expecting 5% VAT. HMRC's 'historical interest' test requires the car be substantially as produced. Singer-style rebuilds, engine swaps, and period-incorrect paintwork disqualify the car — revert to 20% standard rate.",
    "Importing a US-spec Porsche without pricing IVA conversion first. UK-pattern headlights, rear fog lamp, and mph speedometer conversion can add £1,500–£5,000 and 4–8 weeks of shop time on top of the IVA test fee itself.",
    "Using Dover for container cars. Dover is ferry-optimised; container imports route through Southampton, Felixstowe, or Tilbury. Check with your broker before booking the shipping leg.",
    "Under-declaring value to HMRC. UK customs cross-references auction results and historic Porsche market indices; materially low declarations trigger reassessment plus penalties and delay release.",
  ],
  timeline:
    "End-to-end, a post-Brexit Porsche import into the UK takes 8–14 weeks: 1–2 weeks of export prep, 1 week (EU road transport) or 4–6 weeks (US container) of transit, 1 week of port clearance and NOVA filing, 2–4 weeks for DVLA V5C issuance, plus 4–8 additional weeks if IVA is required. EU-sourced cars with CoC can complete in 5–7 weeks total; US-sourced cars with IVA and conversion work typically run 14–20 weeks.",
  faqs: [
    {
      question: "Can I still import a Porsche from the EU to the UK post-Brexit?",
      answer:
        "Yes, but it is no longer duty-free or paperwork-free. Since January 2021, EU-to-UK car imports require a customs declaration, 20% VAT (or 5% reduced rate for 30+ year historics), and potentially 10% duty — though most EU-built Porsches qualify for 0% duty under the UK-EU TCA if the seller provides the correct origin declaration. Use a UK customs broker; the process adds roughly £300–£600 and 5–10 business days versus pre-Brexit movements.",
    },
    {
      question: "How do I qualify for the UK 5% reduced VAT rate on a historic Porsche?",
      answer:
        "The car must be 30+ years old (measured from date of first registration), of historical interest (HMRC Notice 362 — collector Porsches almost always qualify), and in substantially original condition. The 5% rate must be claimed at the time of customs entry; your broker files the supporting documentation (Porsche Certificate, period photos, ownership history) alongside the import declaration. On a £150,000 car, the saving is £22,500 versus the 20% standard rate. Heavily modified cars, restomods, and engine-swapped cars are not eligible.",
    },
    {
      question: "What is the difference between IVA and NOVA?",
      answer:
        "They address different things. NOVA (Notification of Vehicle Arrival) is an HMRC notification that confirms VAT status — filed within 14 days of arrival, required by DVLA before V5C issuance. IVA (Individual Vehicle Approval) is a DVSA technical inspection confirming the vehicle meets UK construction and lighting standards — only required for cars without existing EU/UK type approval (typically US-market or Japanese-market cars). Every import files NOVA; only non-EU-type-approved cars also need IVA.",
    },
    {
      question: "Can I register a left-hand-drive Porsche in the UK?",
      answer:
        "Yes — LHD cars are fully legal to register and drive in the UK. DVLA issues a standard V5C and there are no additional technical requirements beyond the normal import path. That said, LHD Porsches trade at a 15–25% discount to equivalent RHD cars in the UK market, particularly for 911s where Porsche has offered factory RHD production across all generations. For driving use, LHD is a non-issue; for resale, it is a material value consideration.",
    },
    {
      question: "Is a 30+ year Porsche MOT-exempt in the UK?",
      answer:
        "Vehicles 40+ years old are automatically MOT-exempt under the 'historic vehicle' rolling exemption — the owner submits form V112 each year confirming no substantial change. The 30-year threshold relates to VAT and tax class, not MOT. Between 30 and 40 years, an annual MOT is still required. MOT exemption does not relieve the owner of the legal duty to maintain the car in roadworthy condition; many collectors voluntarily continue annual MOTs as a quality check.",
    },
    {
      question: "What is the V5C logbook process for an imported Porsche?",
      answer:
        "After customs clearance and NOVA filing, submit form V55/5 to DVLA Swansea with: original foreign title (surrendered), NOVA confirmation, C79 VAT certificate, CoC or IVA certificate, insurance certificate, and £55 first-registration fee plus VED. DVLA processes via post — expect 2–6 weeks, though complex cases can extend to 8–10 weeks. The V5C logbook is the UK's vehicle title and is required for any resale. Loss of the V5C requires a replacement application (£25) and can delay a sale by weeks.",
    },
    {
      question: "Which UK port is best for a Porsche import?",
      answer:
        "For EU road transport: Dover, Folkestone (Eurotunnel), or Sheerness — fast processing, broker-familiar. For container sea freight from US: Southampton is the default for collector cars (specialist handling, direct onward transport to Home Counties garages); Felixstowe handles higher volume but less collector-specific service; Grimsby and Immingham are cost-effective for Northern England delivery. From Japan: Southampton or Tilbury. Choose the port closest to final destination to minimise domestic transport.",
    },
    {
      question: "How long does a post-Brexit Porsche import to the UK take?",
      answer:
        "EU-sourced car with CoC: 5–7 weeks total (1 week export prep, 1 week Channel transit, 1 week port clearance + NOVA, 2–4 weeks DVLA V5C). US-sourced car requiring IVA: 14–20 weeks (2 weeks export, 4–6 weeks container, 1 week port, 4–8 weeks IVA including conversion work, 2–4 weeks DVLA). Japan-sourced car: similar to US timeline, with additional 2 weeks of sea transit.",
    },
    {
      question: "Can I import a Porsche from the USA to the UK — steps and costs?",
      answer:
        "Yes, and post-Brexit it is no less practical than EU sourcing (both now require full customs paperwork). Steps: buy the car, container ship to Southampton (£2,200–£3,800, 4–6 weeks), clear UK customs (10% duty on non-preferential origin, 20% VAT or 5% reduced for 30+ year historics, £250–£500 broker), file NOVA within 14 days, complete IVA test if required (£450–£600 test + £1,500–£5,000 in conversion work for US-spec lighting and mph speedo), register with DVLA (£55 + VED). All-in, expect 30–45% of purchase price in landed costs plus roughly 14–20 weeks of elapsed time.",
    },
  ],
  keywords: [
    "import Porsche to UK",
    "Porsche import UK post Brexit",
    "UK reduced VAT historic Porsche",
    "NOVA Porsche UK",
    "IVA Porsche UK",
    "DVLA V5C imported Porsche",
    "import Porsche from EU to UK",
    "Porsche MOT exemption UK",
    "HMRC Notice 362 Porsche",
    "import Porsche from USA to UK",
    "left hand drive Porsche UK",
    "UK customs Porsche import",
  ],
};
