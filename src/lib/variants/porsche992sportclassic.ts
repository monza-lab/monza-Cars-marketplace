import type { PorscheVariantPage } from "./types";

export const porsche992sportclassic: PorscheVariantPage = {
  slug: "992-sport-classic",
  shortName: "992 Sport Classic",
  fullName: "Porsche 911 Sport Classic (992)",
  parentModelSlug: "992",
  tagline: "Heritage Design — Turbo S engine, 7-speed manual, narrow body.",
  intro: [
    "The 992 Sport Classic is the second chapter of Porsche's Heritage Design strategy and the only 992-generation 911 sold with a narrow Carrera body. Produced in exactly 1,250 units across 2022 and 2023, it pairs the 3.8L twin-turbo flat-six from the 992 Turbo S — detuned to 542 hp — with a seven-speed manual gearbox, Sport Grey Metallic paint, a fixed duck-tail rear deck, and retro Fuchs-style wheels.",
    "The combination is unique in the 992 line. Every other 992 Carrera is offered only in widebody form; the Sport Classic adopts the Turbo's 1,900mm rear track and wide rear fenders while keeping the narrow Carrera front-end visual language. The result is a body combination that is neither a Carrera nor a Turbo S — it exists solely in Sport Classic trim. The manual transmission rated for 542 hp is also a first for a modern Porsche product at this power level.",
    "MSRP was approximately $272,000 in the US at launch. Allocation was tightly controlled and heavily weighted to existing Heritage Design customers. Secondary-market trades moved above MSRP immediately and the car currently changes hands in the $450k–$700k+ band depending on spec and mileage. It sits alongside the 992 S/T (1,963 units, 2023–2024) and the upcoming Heritage Design finale as Porsche's most self-consciously collector-targeted 911 variants.",
  ],
  yearRange: "2022–2023",
  production: "Exactly 1,250 units globally",
  significance: [
    "The Sport Classic is the second of four planned Heritage Design editions (Targa 4S Heritage Design was first in 2020; Sport Classic in 2022; a third and fourth chapter to follow). It represents Porsche's most deliberate attempt to monetize vintage design references in the modern lineup — the Fuchs-style wheels, duck-tail spoiler, and Sport Grey Metallic paint are direct citations of the 1973 Carrera RS 2.7 and the 1970s Sport Classic concept.",
    "Mechanically it is significant as the highest-output manual 911 Porsche has ever produced at the point of launch. The 542 hp rating was dictated by two constraints: the seven-speed manual gearbox's published torque capacity and emissions certification for a naturally aspirated-style calibration on the turbocharged engine. It is also the only 992 chassis that combines narrow front-track with Turbo rear-track body geometry — a configuration not offered in any other trim.",
  ],
  specs: [
    { label: "Engine", value: "3.8L twin-turbo flat-six (shared block with 992 Turbo S)" },
    { label: "Power", value: "542 hp @ 6,500 rpm — detuned from Turbo S's 640 hp" },
    { label: "Torque", value: "442 lb-ft @ 2,000–6,000 rpm" },
    { label: "Transmission", value: "7-speed manual — no PDK option" },
    { label: "Drive", value: "Rear-wheel drive (Turbo S is AWD — Sport Classic is RWD only)" },
    { label: "Weight", value: "≈1,570 kg (3,461 lb)" },
    { label: "0–100 km/h (0–62 mph)", value: "4.1 s" },
    { label: "Top speed", value: "315 km/h (196 mph)" },
    { label: "Body", value: "Narrow Carrera front, widebody Turbo rear, fixed duck-tail spoiler" },
    { label: "Wheels", value: "20/21-inch Fuchs-style forged alloys, central-lock style with 5-bolt construction" },
    { label: "Suspension", value: "PASM sport suspension with rear-axle steering standard" },
  ],
  identifiers: [
    { label: "VIN pattern", value: "WP0AB2A94NS25XXXX (2022) / WP0AB2A94PS25XXXX (2023) — N for 2022, P for 2023" },
    { label: "Engine code", value: "9A2 (same block family as 992 Turbo S, detuned)" },
    { label: "Paint (standard)", value: "Sport Grey Metallic — heritage-specific colour, not offered on other 992 trims" },
    { label: "Paint (optional)", value: "Black, Agate Grey Metallic, Gentian Blue Metallic, or Paint-to-Sample" },
    { label: "Exterior cues", value: "Fixed duck-tail rear deck, twin-stripe centre graphic (optional), Porsche heritage crest on front hood, gold-on-black 'Porsche' side script, Fuchs-style wheels" },
    { label: "Interior", value: "Two-tone Cognac/Black Club leather (standard), Pepita houndstooth cloth seat centres (heritage option), wood trim with Porsche heritage crest headrest embroidery" },
    { label: "Option codes", value: "Heritage Design Package (standard on Sport Classic), PCCB optional, front-axle lift, Burmester audio, Sport Chrono standard" },
  ],
  priceBands: [
    { label: "Driver-grade", range: "$450k–$525k", note: "Delivered 2022, 3,000+ km, standard Sport Grey spec, used but well-maintained" },
    { label: "Excellent low-miles", range: "$525k–$625k", note: "Under 1,500 km, original-owner, documented allocation, standard or popular option spec" },
    { label: "Delivery-mile / highly-specced", range: "$625k–$750k+", note: "Sub-500 km, Paint-to-Sample or rare colour, full Heritage Design option content, first owner" },
    { label: "PTS / high-profile provenance", range: "$700k–$900k+", note: "Paint-to-Sample with desirable colour, notable original owner, or exceptional build sheet" },
  ],
  faqs: [
    {
      question: "How many 992 Sport Classic were made?",
      answer:
        "Exactly 1,250 units globally across 2022 and 2023 production. Porsche closed allocation at this hard cap and there is no extended production run. The number was set to echo the model's positioning — reference to the broader Heritage Design series rather than the 992 model code directly, which distinguishes it from the 911 R (991 units) and 992 S/T (1,963 units) naming logic.",
    },
    {
      question: "Why does the 992 Sport Classic have a narrow body when other 992 Carreras are widebody only?",
      answer:
        "All 992-generation Carreras (including base, S, GTS, and 4S) adopted the widebody Turbo-derived rear track as standard. The Sport Classic is the only 992 sold with a visually narrow Carrera front end paired with the Turbo's widebody rear — a deliberate design choice referencing the 1973 Carrera RS 2.7 proportion. It is the only 992 chassis that combines these dimensions, and Porsche has confirmed this configuration will not be offered in any other 992 trim.",
    },
    {
      question: "Why is the Sport Classic only 542 hp when the Turbo S engine makes 640 hp?",
      answer:
        "Two reasons. First, the seven-speed manual gearbox used in the Sport Classic has a published torque rating below what the 640 hp Turbo S tune produces (590 lb-ft) — detuning to 442 lb-ft keeps the gearbox within its certified envelope. Second, emissions and noise certification for the manual-transmission calibration required a different tune than the PDK-equipped Turbo S. The 542 hp figure is a hardware and certification outcome, not a marketing choice.",
    },
    {
      question: "What is the Heritage Design strategy?",
      answer:
        "Porsche's Heritage Design series is a four-chapter limited-edition program launched in 2020. The chapters announced or released to date: (1) 911 Targa 4S Heritage Design Edition (2020, 992 Targa with 1950s cues, 992 units); (2) 992 Sport Classic (2022–2023, 1,250 units); (3) and (4) to follow — Porsche has confirmed the series will span four editions, each referencing a different decade of 911 design. Each chapter uses period-correct colours, graphics, interior trim, and wheel designs drawn from a specific era.",
    },
    {
      question: "How does the 992 Sport Classic compare to the 992 S/T?",
      answer:
        "The S/T (Sport Touring) is a separate 60-year anniversary variant launched in 2023, produced in 1,963 units to reference the year of the original 911. It uses the 911 GT3 RS 4.0L naturally aspirated engine rated at 518 hp with a six-speed manual, carbon fibre body panels, and a GT-line chassis tune. The Sport Classic uses the Turbo S twin-turbo engine at 542 hp with a seven-speed manual and the Heritage Design aesthetic. Different engines, different chassis philosophies, different target customers — the S/T is track-ready, the Sport Classic is a heritage GT cruiser.",
    },
    {
      question: "What are the Fuchs-style wheels on the 992 Sport Classic?",
      answer:
        "They are a modern forged interpretation of the 1960s-1970s Fuchs 'five-leaf' five-spoke design first fitted to the 1967 911 S. The Sport Classic wheels are 20-inch front / 21-inch rear, forged alloy with a satin-black spoke finish and polished rim lip, produced specifically for this model. They are visually the closest modern Porsche has come to reissuing the classic Fuchs aesthetic and they are not shared with any other 992 trim.",
    },
    {
      question: "What is the duck-tail spoiler reference?",
      answer:
        "The fixed duck-tail rear deck references the 1973 Carrera RS 2.7's 'Bürzel' (duck-tail) spoiler — Porsche's first factory-fitted aerodynamic tail. The Sport Classic version is a fixed-position carbon-fibre piece rather than the pop-up active wing used on standard 992 Carreras. It is functional (provides measurable rear downforce at speed) but its presence is primarily a design citation of the 2.7 RS lineage.",
    },
    {
      question: "How rare is a 542 hp manual 911?",
      answer:
        "The Sport Classic is the highest-output manual 911 Porsche has produced at the point of launch. By comparison: the 991 R made 500 hp with a six-speed manual; the 991.2 GT3 with Touring package made 500 hp manual; the 992 GT3 Touring produces 502 hp with a six-speed manual; the 992 S/T produces 518 hp with a six-speed manual. At 542 hp with a seven-speed manual, the Sport Classic is currently the most powerful three-pedal 911 in the factory catalogue, and the only turbocharged manual 911 at this output level.",
    },
    {
      question: "Is the 992 Sport Classic trading above MSRP?",
      answer:
        "Yes. MSRP was approximately $272,000 in the US. Secondary-market trades have consistently cleared above MSRP from first delivery onward, with current sales in the $450k–$700k+ band depending on mileage, spec, and colour. Paint-to-Sample examples and cars with notable provenance trade at the top of the band. The car is still actively trading rather than being held — inventory appears at auction and private sale throughout 2024–2026.",
    },
    {
      question: "What should I check on a 992 Sport Classic pre-purchase inspection?",
      answer:
        "Verify Porsche build sticker and Heritage Design option code documentation, confirm allocation was original (not flipped through multiple pre-delivery hands), check for paint originality especially around the Fuchs-style wheel arches and duck-tail spoiler mounting points, verify the seven-speed manual gearbox shifts cleanly across all gears, and confirm Pepita cloth interior (if specified) is original and not aftermarket retrim. PCCB wear should be assessed if equipped. A Porsche dealer service record is expected given the car's age and the owner profile.",
    },
  ],
  buyerConsiderations: [
    "Allocation provenance matters — cars that changed hands pre-delivery (dealer to broker to retail buyer) carry a discount to cars with a clean original-owner path.",
    "Spec variance is meaningful. Standard Sport Grey Metallic is the benchmark; Paint-to-Sample examples, particularly in period-correct colours, command significant premiums.",
    "Mileage discipline is tight — as with other Heritage Design and limited-production Porsches, each 1,000 km materially affects value at this stage of the ownership curve.",
    "The Sport Classic is currently in warranty for most examples; factor remaining warranty coverage into the purchase. Out-of-warranty service costs track 992 Turbo S levels.",
    "Manual gearbox wear should be inspected carefully — the seven-speed is shared hardware with other 992 manuals but runs closer to its torque ceiling in this application.",
    "Documentation of original build sheet, window sticker, and Porsche Certificate of Authenticity should be requested. Allocation-era emails and correspondence add to provenance value.",
  ],
  thesis:
    "The 992 Sport Classic is a current-production Heritage Design limited edition trading at meaningful premiums to MSRP. At 1,250 units, a unique body configuration, and a 542 hp manual specification that Porsche has not offered elsewhere, the scarcity case is structurally sound. The car is still early in its collector life cycle — price discovery is active rather than settled, and the trading band reflects real demand rather than distressed inventory. Buyers should evaluate it as a scarcity-driven Heritage Design asset with documented Porsche strategic significance, while recognizing that current-production limited editions carry more price-discovery variance than established collector variants.",
  keywords: [
    "Porsche 992 Sport Classic",
    "992 Sport Classic for sale",
    "992 Sport Classic production",
    "992 Sport Classic price",
    "Porsche Heritage Design",
    "992 Sport Classic manual",
    "Sport Classic Fuchs wheels",
    "992 Sport Classic duck-tail",
    "Sport Classic vs S/T",
    "Porsche 911 Sport Classic 2022",
    "Sport Grey Metallic 911",
    "992 narrow body Sport Classic",
  ],
};
