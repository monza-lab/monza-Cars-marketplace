import type { PorscheVariantPage } from "./types";

export const porsche964rs: PorscheVariantPage = {
  slug: "964-rs",
  shortName: "964 RS",
  fullName: "Porsche 911 (964) Carrera RS",
  parentModelSlug: "964",
  tagline: "The lightweight 964 — Porsche's first RS since the 1973 Carrera RS 2.7.",
  intro: [
    "The 964 Carrera RS was Porsche's return to the RS formula after nearly two decades — a homologation special for GT racing, sold to customers in limited numbers for Europe only. It is the spiritual successor to the 1973 Carrera RS 2.7 and, in many collector conversations, its equal.",
    "Compared to a standard 964 Carrera, the RS is roughly 155 kg (340 lb) lighter, with aluminum hood and front fenders, thinner glass, stripped interior (no radio, no rear seats, no sound deadening on base Lightweight), manual steering, closer-ratio transmission, and a stiffer suspension with solid engine mounts. The engine is the 3.6L M64 tuned to ~260 hp — more than the Carrera — and revs harder.",
    "The RS is not for everyone. It is loud, stiff-riding, noisier at the steering column, and requires commitment. It is also one of the purest driver's 911s ever made, and the market has recognized it — clean RS examples trade in the $300k–$700k range depending on spec and provenance, with 3.8 RS at the top. It will not get cheaper.",
  ],
  yearRange: "1992–1993",
  production: "≈2,051 units (Euro RS: 2,051 across all sub-variants; excludes US-market RS America)",
  significance: [
    "The 964 RS is the benchmark for 'modern classic air-cooled RS'. It bridges the 1973 Carrera RS 2.7 (the original lightweight 911) and the later 993 RS, with the 964 RS being the first time Porsche revived the concept in a decade. Its purity — manual steering, no ABS on base Lightweight, minimal electronics — is increasingly rare in any collector 911.",
    "The RS was Euro-only. The US received the RS America (1993-1994, 701 units), a different car with more equipment. True 964 RS cars in the US are gray-market imports and carry small import-documentation risk. Matching-numbers, documented Euro RS examples with original paint are the blue-chip standard.",
  ],
  specs: [
    { label: "Engine", value: "3.6L M64/03 air-cooled flat-six" },
    { label: "Power", value: "260 hp @ 6,100 rpm" },
    { label: "Torque", value: "240 lb-ft @ 4,800 rpm" },
    { label: "Transmission", value: "G50/10 5-speed manual, closer ratios vs Carrera" },
    { label: "Drive", value: "Rear-wheel drive" },
    { label: "Weight", value: "≈1,220 kg (2,690 lb) base Lightweight — 155 kg less than Carrera 2" },
    { label: "0–100 km/h (0–62 mph)", value: "5.3 s" },
    { label: "Top speed", value: "260 km/h (162 mph)" },
    { label: "Suspension", value: "Stiffer springs/dampers, solid engine mounts, adjustable rear" },
    { label: "Brakes", value: "Larger discs vs Carrera, no ABS on base Lightweight" },
    { label: "Wheels", value: "Cup Design I — 7×17 front / 9×17 rear (magnesium on Lightweight)" },
  ],
  identifiers: [
    { label: "VIN pattern", value: "WP0ZZZ96ZNS49XXXX (Euro RS), 93-model-year chassis" },
    { label: "Engine code", value: "M64/03" },
    { label: "Body", value: "Aluminum hood, aluminum front fenders, thinner glass (4mm)" },
    { label: "Interior", value: "Fixed-back Recaro buckets, no rear seats, carbon door cards, red pull-straps, no radio on base Lightweight" },
    { label: "Exterior", value: "RS badge on rear deck lid, Cup wheels, no chrome trim on Lightweight" },
    { label: "Option code N/GT", value: "Lightweight (base) = M002; Touring = M003; NGT = M004; RS America is US-only M030" },
  ],
  subVariants: [
    { name: "RS Lightweight (M002)", yearRange: "1992–1993", production: "≈2,051 total Euro RS", note: "Base spec. Minimal sound deadening, no rear seats, manual windows on early cars, most purist-preferred." },
    { name: "RS Touring (M003)", yearRange: "1992–1993", note: "Adds sound deadening, power windows, radio, air conditioning. More usable as daily; trades at ~15-25% discount vs Lightweight." },
    { name: "RS NGT (M004)", yearRange: "1993", production: "≈290 units", note: "'N-GT' spec — Clubsport-adjacent with welded roll cage, fire suppression prep. Rarest base RS, premium over Lightweight." },
    { name: "3.8 RS", yearRange: "1993", production: "≈55 units", note: "3.8L engine, 300 hp, widebody with Turbo fenders. Apex 964 RS — trades $1M+ for clean examples." },
    { name: "RS 3.8 Clubsport", yearRange: "1993", production: "≈15–20 units", note: "Factory race homologation version of 3.8 RS. Blue-chip, rarely trades." },
  ],
  priceBands: [
    { label: "Driver-grade Lightweight/Touring", range: "$250k–$350k", note: "Original paint, documented history, average mileage (~40-60k km)" },
    { label: "Excellent Lightweight", range: "$350k–$500k", note: "Matching numbers, original paint, low mileage, full service history" },
    { label: "Concours Lightweight", range: "$500k–$700k", note: "Zero-issue matching-numbers with provenance (known ownership chain, ideally single-owner)" },
    { label: "NGT", range: "$450k–$700k", note: "Premium over base Lightweight reflecting ~290-unit scarcity" },
    { label: "3.8 RS", range: "$900k–$1.5M+", note: "Apex collector asset; each trade watched by the market" },
  ],
  faqs: [
    {
      question: "How many Porsche 964 RS were made?",
      answer:
        "Approximately 2,051 Euro RS cars across all sub-variants (Lightweight, Touring, NGT, 3.8 RS, 3.8 RS Clubsport). The base Lightweight represents the majority. The NGT is ≈290 units, the 3.8 RS is ≈55 units, and the 3.8 RS Clubsport is ≈15-20 units. The US-market RS America (701 units, 1993-1994) is a distinct car, not part of the Euro RS count.",
    },
    {
      question: "Is a 964 RS a good investment in 2026?",
      answer:
        "The 964 RS has appreciated steadily for 8+ years and is considered established blue-chip. Driver-grade Lightweights trade $250k-$350k; concours examples $500k-$700k; 3.8 RS north of $1M. Further multi-bagger returns are unlikely from current levels, but the scarcity (≈2,051 cars globally), documented appreciation curve, and status as the definitive modern air-cooled RS suggest values are unlikely to retreat materially. It's a hold, not a flip.",
    },
    {
      question: "What's the difference between a 964 RS and a 964 Carrera?",
      answer:
        "The RS is ≈155 kg (340 lb) lighter, with aluminum hood and front fenders, thinner glass, closer-ratio G50/10 transmission, solid engine mounts, stiffer suspension, manual steering, fixed-back Recaro buckets, no rear seats, and no sound deadening on base Lightweight. Engine power is ≈260 hp vs 247 hp. Visually, the RS has Cup wheels, RS badging, and (on Lightweight) no chrome trim. The Carrera is the usable road car; the RS is the homologation-spec driver's tool.",
    },
    {
      question: "Is the 964 RS America the same as the Euro 964 RS?",
      answer:
        "No. The RS America (1993-1994, 701 units) is a US-market lightweight model that shares the philosophy but not the mechanicals — it uses the standard 247 hp Carrera engine, keeps regular-ratio transmission, retains ABS and power steering, and has fewer weight-reduction measures. It's a meaningful car in its own right (clean examples now trade $150k-$250k) but it is not the Euro RS. Confusing the two is a common buyer mistake.",
    },
    {
      question: "What should I check on a 964 RS pre-purchase inspection?",
      answer:
        "Beyond standard 964 items (dual-mass flywheel, DME relay, engine case leaks), RS-specific checks: matching-numbers confirmation (engine, transmission, body), original Recaro buckets and door cards (often missing from crash-damaged cars), original Cup wheels, option code M002/M003/M004 documentation, aluminum panel originality (replaced aluminum panels vs steel signals prior damage), suspension geometry (many RS cars tracked hard), and chassis alignment (verify no unrepaired impact). Provenance documentation — PO chain, service records, race history — is critical to value.",
    },
    {
      question: "Can I daily-drive a 964 RS?",
      answer:
        "The Touring spec (M003) is daily-usable — it has AC, power windows, radio, and full sound deadening. The Lightweight is drivable but intentionally noisy, stiff, and loud. Most owners drive either variant 2,000-5,000 km/year, not as a daily. Hard use has a negative impact on the collector premium (mileage is scrutinized closely), so serious daily use is uncommon among blue-chip examples.",
    },
    {
      question: "What's the difference between the 964 RS Lightweight and Touring?",
      answer:
        "The Lightweight (M002) is the purist spec: no sound deadening, no rear seats, manual windows on early cars, no radio, fixed-back Recaros, thinner carpet. The Touring (M003) adds sound deadening, power windows, radio, AC, and upgraded seats while keeping the aluminum panels and stiffer suspension. Lightweight commands a 15-25% premium over Touring of equivalent condition, reflecting the purer spec and slightly higher rarity.",
    },
    {
      question: "How do I authenticate a 964 RS?",
      answer:
        "Check VIN (Euro RS uses WP0ZZZ96ZNS49XXXX pattern for 1993 model year), engine number (M64/03), option code sticker (M002/M003/M004/M030), Porsche Certificate of Authenticity (mandatory due diligence), matching-numbers body/engine/transmission, and independent inspection by a 964-specialist shop. A car advertised as RS without a Porsche COA should be treated with suspicion.",
    },
    {
      question: "What makes the 964 3.8 RS so expensive?",
      answer:
        "Extremely low production (≈55 units across 1993), 3.8L engine producing 300 hp, widebody with Turbo rear fenders, and homologation-special status for factory race programs. It's the apex 964 collector car and trades in the $900k-$1.5M+ band. The 3.8 RS Clubsport (≈15-20 factory race-prep units) is rarer still and rarely changes hands publicly.",
    },
  ],
  buyerConsiderations: [
    "Matching-numbers status is the single biggest value lever — an 'engine replacement' history can halve the price of an otherwise clean RS.",
    "Porsche Certificate of Authenticity (COA) is mandatory due diligence. Sellers unwilling to provide one should be declined.",
    "Original paint retains the strongest value; any repaint (even high-quality) reduces value meaningfully (~10-20%). Respray with documented accident history can cut 30-40%.",
    "Racing provenance can add value IF documented, but unknown track history (suspension geometry off, chassis alignment) can reduce it sharply. Get a specialist pre-purchase inspection.",
    "NGT spec commands a premium — verify option code M004 before paying NGT money. Body panels alone are not proof.",
    "Gray-market US imports carry minor discount vs EU-titled examples. Non-federalized cars may have registration restrictions in some US states.",
  ],
  thesis:
    "The 964 RS is established blue-chip collector territory. Values have compounded steadily for eight-plus years and show no signs of retreat. Further aggressive appreciation is unlikely from current entry points — this is a hold and preserve-of-wealth asset, not a growth play. The 3.8 RS and 3.8 RS Clubsport occupy a separate tier; both remain supply-constrained enough that trade activity is thin and prices remain firm.",
  keywords: [
    "Porsche 964 RS",
    "964 Carrera RS",
    "964 RS Lightweight",
    "964 RS Touring",
    "964 RS NGT",
    "964 3.8 RS",
    "Porsche 964 RS for sale",
    "964 RS price 2026",
    "964 RS investment",
    "Porsche air-cooled RS",
    "964 Carrera RS production",
    "964 RS America comparison",
  ],
};
