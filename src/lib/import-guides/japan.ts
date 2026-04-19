import type { ImportGuide } from "./types";

export const japanImportGuide: ImportGuide = {
  slug: "japan",
  country: "Japan",
  tagline: "One of the world's most permissive import regimes — no age cap, LHD-legal, Shaken-gated.",
  title: "How to Import a Porsche to Japan — Customs, Shaken, Historical Plate | MonzaHaus",
  intro: [
    "Importing a Porsche to Japan is administratively demanding but regulatorily generous. Japan imposes no age ceiling on imported passenger cars, no emissions retrofit requirement for vehicles 25 years or older, and — critically for Porsche buyers — treats left-hand-drive as fully legal and unremarkable. The regime is best understood as 'unrestricted on paper, gated by inspection in practice.'",
    "The single most consequential checkpoint is Shaken (車検), Japan's biennial roadworthiness inspection. For a newly imported Porsche, the initial Shaken is performed at registration and is materially more expensive and more thorough than a typical US state safety inspection or European MOT/TÜV equivalent. Everything else — duty, tax, customs clearance — is arithmetic. Shaken is where budgets and timelines bend.",
    "Tariffs on passenger cars to Japan are 0% under current trade agreements. What the buyer actually pays is a 10% consumption tax on CIF value plus roughly 3% acquisition tax at registration, a licensed customs agent fee in the ¥50,000–¥150,000 range, and the Shaken pass — not a trivial figure for a 30-year-old air-cooled car arriving from Stuttgart.",
    "This guide walks the end-to-end process for a collector Porsche arriving at Yokohama, Kobe, or Nagoya, with particular attention to the LHD-specific mirror and headlight requirements, the Historical Plate pathway for 30+ year vehicles, and the practical resident-vs-non-resident constraints on registration.",
  ],
  regulatoryContext: [
    "National: MLIT (Ministry of Land, Infrastructure, Transport and Tourism) governs vehicle type approval and inspection; Japan Customs administers import clearance under the PHP (Parallel Handling Permit) framework — formally 輸入自動車通関の許可. Prefectural: each 陸運局 (Land Transport Bureau) issues plates and holds the vehicle record. Passenger-car import duty is 0%. Consumption tax is 10% on CIF value plus any duty. Acquisition tax is approximately 3% of declared value at registration.",
    "There is no age restriction on imports and no requirement to retrofit emissions equipment for vehicles 25 years or older — they qualify as 'classic' and bypass the emissions portion of Shaken. What is NOT waived is the mechanical, dimensional, and lighting portion of Shaken, which remains mandatory at every registration and every two years thereafter. Historical Plate status (for 30+ year vehicles) reduces annual road tax and can be applied for after registration.",
    "Left-hand-drive is legal and common — roughly 6–8% of registered vehicles in Japan are LHD. However, older Porsches (pre-1986 particularly) often arrived with minimal or asymmetric mirror arrangements that fail modern Shaken rear-view coverage rules. A right-side fender mirror or wider rearview is frequently required to pass initial inspection on LHD cars. Headlight beam pattern must be symmetric or adjusted — Japan drives on the left, so EU/US continental beam patterns aimed for right-traffic require realignment.",
  ],
  steps: [
    {
      name: "Confirm buyer eligibility and registration pathway",
      text: "Non-residents can legally own a Porsche in Japan but cannot register a vehicle without a Japanese address and a jūminhyō (住民票) resident record or juridical equivalent. Foreign buyers without residency typically register via a Japanese-resident proxy, a KK/GK corporation, or an import dealer's trade plate arrangement. Confirm the registration pathway before wiring funds — a car sitting in bonded storage accrues demurrage.",
    },
    {
      name: "Find the car abroad and commission pre-purchase inspection",
      text: "The strongest source markets for Japan-bound collector Porsches are Germany (spec authenticity, matching-numbers density) and the US (air-cooled 911 volume, strong maintenance records). Commission an independent PPI — Porsche Classic Partner in Germany, a marque-specialist shop in the US — before wiring. Japan buyers typically demand documented history: service book, stamped maintenance records, COA from Porsche Classic.",
    },
    {
      name: "Arrange shipping (container strongly preferred)",
      text: "For collector Porsches, container shipping is standard; RoRo is rare and discouraged for high-value cars. Transit times: US West Coast → Yokohama 3 weeks; Hamburg → Yokohama 6–7 weeks via Panama or Suez; Southampton → Yokohama 6–8 weeks. Major receiving ports are Yokohama (largest volume, most agent capacity), Kobe (strong for Kansai delivery), and Nagoya (central Japan). Insure at full declared value; Japan-bound CIF is the consumption-tax base.",
      url: "https://www.customs.go.jp/english/index.htm",
    },
    {
      name: "Japanese customs clearance via licensed agent",
      text: "Engage a licensed customs agent (通関業者) to file the import declaration. The agent prepares the PHP documentation — formally the 輸入自動車通関の許可 package — which includes the commercial invoice, bill of lading, foreign title, export certificate, and the MLIT import application. Agent fees run ¥50,000–¥150,000. DIY clearance is possible but rarely attempted — the paperwork is almost entirely in Japanese and port officials expect agent filings.",
    },
    {
      name: "Pay consumption tax and acquisition tax",
      text: "Consumption tax (10% of CIF value, plus any duty — duty is 0% on passenger cars) is paid to Japan Customs at clearance. Acquisition tax (~3% of declared value) is paid at registration, not at port. For a ¥20M CIF 993 Carrera, consumption tax is ¥2M and acquisition tax is roughly ¥600K — this is the largest single line item outside the purchase price itself.",
    },
    {
      name: "Initial Shaken (車検) inspection",
      text: "Book an initial Shaken at a Japan Automobile Inspection Association (JAI / 軽自動車検査協会 for kei, 自動車検査登録事務所 for普通) facility or authorized shop. For an imported collector Porsche expect ¥150,000–¥300,000 all-in, which includes exhaust analysis (waived for 25+ year cars but emissions-visual still performed), headlight pattern, brake test, dimensional/weight check against the imported registration document, and — for LHD — rear-view mirror coverage and fender-mirror requirement for older specs. Failed items must be remediated before reinspection.",
    },
    {
      name: "Register with the local 陸運局 (Land Transport Bureau)",
      text: "With passed Shaken, the customs release (輸入自動車通関証明書), the foreign title, and proof of parking space (車庫証明 — shakoshōmeisho, issued by local police based on a surveyed parking location) you register at the prefectural Land Transport Bureau. White plates are issued for standard passenger use. Registration fees typically ¥30,000–¥60,000 inclusive of plate issuance and recycling-fee certificate.",
    },
    {
      name: "Optional: Historical Plate application (30+ years)",
      text: "Porsches 30 years or older qualify for Historical Vehicle status, which substantially reduces annual automobile tax (自動車税). The program is administered at the prefectural level — most prefectures issue a distinct plate or record marker. Application is made after initial registration and requires proof of first-registration date (via VIN decode or Porsche COA). Usage restrictions vary by prefecture but are generally lighter than comparable EU classic-status programs.",
    },
  ],
  costs: [
    { label: "Purchase price", estimate: "Varies", note: "Wire to seller or escrow" },
    { label: "Export prep and transport to origin port", estimate: "¥50,000–¥150,000" },
    { label: "Container shipping (US West Coast → Yokohama)", estimate: "¥400,000–¥600,000", note: "3 weeks typical transit; 20ft container, collector car solo" },
    { label: "Container shipping (EU → Yokohama)", estimate: "¥600,000–¥900,000", note: "6–7 weeks via Panama or Suez; choose route based on season" },
    { label: "Marine insurance", estimate: "1.25–2% of CIF value", note: "Required; consumption tax base is CIF" },
    { label: "Customs agent fee (PHP filing)", estimate: "¥50,000–¥150,000" },
    { label: "Import duty", estimate: "0%", note: "Passenger cars — abolished under trade agreements" },
    { label: "Consumption tax", estimate: "10% of CIF value + duty", note: "Paid to Japan Customs at clearance" },
    { label: "Acquisition tax", estimate: "~3% of declared value", note: "Paid at registration, prefectural" },
    { label: "Initial Shaken inspection (collector Porsche)", estimate: "¥150,000–¥300,000", note: "2–3x a typical domestic Shaken; LHD prep and mirror remediation add cost" },
    { label: "Registration fees and parking certificate (車庫証明)", estimate: "¥30,000–¥60,000" },
    { label: "Domestic transport (port to garage)", estimate: "¥30,000–¥100,000", note: "Enclosed trailer recommended for collector cars" },
  ],
  pitfalls: [
    "Assuming 'LHD is legal' means 'LHD will pass Shaken unchanged' — older Porsches frequently need a right-side fender mirror or wider rearview to satisfy rear-view coverage rules. Budget remediation time before the first inspection.",
    "Shipping without a Japanese-resident registration pathway in place. The car clears customs but cannot leave bonded storage indefinitely without a registrant. Demurrage at Yokohama accrues daily.",
    "Underdeclaring CIF to reduce consumption tax. Japan Customs cross-checks against international auction comps (Gooding, RM, Bonhams) and will reassess. Penalties are material.",
    "Converting LHD to RHD for resale value. In Japan, collector Porsches are often MORE valuable as LHD originals than as RHD conversions — conversion is expensive, destroys authenticity, and typically reduces resale value 10–25%.",
    "Missing the Historical Plate application window. For 30+ year cars, annual road tax savings compound meaningfully over a holding period — register Historical status in the first registration year rather than at next renewal.",
    "Choosing port by shipping cost alone. Yokohama has the deepest customs-agent and Shaken-specialist ecosystem for imports; Kobe is strong for Kansai delivery but thinner on Porsche-specialist capacity; Nagoya is cheapest but carries the lightest service bench for collector cars.",
    "Ignoring the parking certificate (車庫証明). No shakoshōmeisho, no registration — and the certificate requires a surveyed, addressed parking location. Apartment dwellers without a parking contract cannot register a car.",
  ],
  timeline:
    "End-to-end, a typical EU → Japan Porsche import takes 14–20 weeks from purchase agreement: 2 weeks European export prep, 6–7 weeks ocean transit, 1–2 weeks port handling and customs clearance, 2–4 weeks for Shaken preparation and pass, 1–2 weeks for parking certificate and registration. US West Coast → Japan compresses to 10–14 weeks on the shipping leg. Initial Shaken is the most schedule-variable step — allow float.",
  faqs: [
    {
      question: "Can foreigners import a Porsche to Japan?",
      answer:
        "Yes — ownership has no nationality restriction. Registration, however, requires a Japanese address and a jūminhyō resident record or a Japanese juridical entity (KK/GK). Non-resident buyers typically register via a Japanese-resident proxy, an import dealer's trade plate, or a domestic corporation. Confirm the registration pathway before shipping, because a car cannot exit bonded storage indefinitely without a registrant.",
    },
    {
      question: "Is Japan's Shaken expensive for imported Porsches?",
      answer:
        "Yes — expect ¥150,000–¥300,000 for an initial Shaken on a collector Porsche, roughly 2–3x a typical domestic Shaken and materially above a US state safety inspection or German TÜV. The premium reflects LHD-specific remediation (mirrors, headlight aim), dimensional reconciliation against the import paperwork, and the time required for the inspector to work through a non-standard specification. Subsequent biennial Shaken for the same car is cheaper once the specification is on file.",
    },
    {
      question: "Do I need to convert my LHD Porsche to RHD for Japan?",
      answer:
        "No. Left-hand-drive is fully legal in Japan and roughly 6–8% of registered vehicles are LHD. For collector Porsches, LHD is typically the preferred configuration — German-market originals command a premium over RHD conversions, and conversion work is expensive, often reduces authenticity, and typically reduces resale value 10–25%. Stay LHD unless the car was originally built RHD for the UK, Japan, or Australia market.",
    },
    {
      question: "What are the Historical Plate requirements for 30-year-old Porsches?",
      answer:
        "Vehicles 30 years or older qualify for Historical Vehicle status, administered at the prefectural level. Application follows initial registration and requires proof of first-registration date — VIN decode plus Porsche Certificate of Authenticity is the standard evidence package. The primary benefit is a meaningful reduction in annual automobile tax (自動車税). Usage restrictions vary by prefecture but are generally lighter than comparable EU classic-status regimes.",
    },
    {
      question: "Can I register a US-import Porsche in Japan without EPA or DOT compliance?",
      answer:
        "Yes. EPA and DOT are US federal regulatory frameworks and have no bearing on Japanese registration. A Porsche imported from the US into Japan is subject to Japanese customs clearance, consumption tax, acquisition tax, and Shaken — nothing more. Retaining the US title and CBP export paperwork is required for customs clearance into Japan but US emissions/safety certifications are simply irrelevant to the Japanese framework.",
    },
    {
      question: "Which ports are best for Porsche imports to Japan?",
      answer:
        "Yokohama is the default — it has the highest import volume, the deepest customs-agent ecosystem, and the strongest bench of Shaken specialists experienced with imported collector cars. Kobe is a strong second choice for Kansai-region delivery (Osaka, Kyoto, Hyogo). Nagoya handles central Japan but has a thinner Porsche-specialist network. Choose on agent capacity and final-destination transport cost, not port fees alone.",
    },
    {
      question: "What is the typical all-in cost for importing a 993 from Germany to Japan?",
      answer:
        "For a ¥20M (~€115K) 993 Carrera from Germany: ¥700K–¥900K shipping and insurance, ¥100K customs agent, ¥0 duty, ¥2M consumption tax (10% of CIF), ¥600K acquisition tax (~3%), ¥250K initial Shaken, ¥50K registration and parking certificate, ¥80K domestic transport. All-in non-purchase cost is roughly ¥3.8M–¥4.1M, or about 19–21% above CIF. This is higher as a percentage than a comparable US import, driven primarily by the 10% consumption tax and the Shaken line.",
    },
    {
      question: "Is it cheaper to buy a Porsche in Japan or to import one?",
      answer:
        "Market-dependent. For Japanese-domestic-market (JDM) Porsches with domestic service history, buying in Japan avoids the consumption tax, acquisition tax, and shipping — a material saving. For rare specifications (German-market GT3s, US-market Speedsters, matching-numbers early 911s), the spec rarely exists in Japan and import is the only practical path. The rule of thumb: if the exact car exists in Japan at fair market, buy domestic; if specification authenticity matters, import and pay the ~20% premium.",
    },
    {
      question: "Does Japan have a 25-year rule like the US?",
      answer:
        "No — Japan has no age ceiling on imports at all. Any Porsche of any age can be imported and registered, subject to Shaken. Vehicles 25 years or older are additionally exempted from emissions retrofit requirements (the 'classic' bypass within Shaken). The net effect is that Japan is meaningfully more permissive than the US for newer collector cars — a 2005 Carrera GT or 2011 GT3 RS 4.0 can be imported to Japan today, whereas the US pathway for the same cars is narrow (Show and Display) or not until their 25th birthday.",
    },
    {
      question: "Why is Japan also a major export source for Porsches globally?",
      answer:
        "While this guide covers importing to Japan, the reverse direction is worth noting: Japan has been a strong exporter of collector Porsches for two decades because of meticulous domestic maintenance culture, strong service documentation, and a generation of JDM-market cars now aging into the US 25-year window. The flow is bidirectional — Japan imports spec-authentic EU cars and exports well-maintained JDM examples. Buyers bringing cars INTO Japan are typically chasing German-market originals that don't exist in the domestic market.",
    },
  ],
  keywords: [
    "import Porsche to Japan",
    "Japan Porsche import guide",
    "Shaken imported Porsche",
    "車検 imported car",
    "Japan customs Porsche",
    "PHP import Japan car",
    "Historical Plate Porsche Japan",
    "import Porsche 993 to Japan",
    "Japan LHD Porsche registration",
    "consumption tax imported car Japan",
    "Yokohama port Porsche import",
    "Japan 陸運局 import registration",
  ],
};
