import type { KnowledgeArticle } from "./types";

export const paintCodesArticle: KnowledgeArticle = {
  slug: "porsche-paint-codes",
  title: "Porsche Paint Codes — Complete Reference for Collectors",
  seoTitle: "Porsche Paint Codes — How to Decode, Rare Colors, Price Impact | MonzaHaus",
  summary:
    "Decode any Porsche paint code, identify rare factory colors by generation, and understand why original paint and color choice can shift market value by 20–40%.",
  category: "authentication",
  intro: [
    "Porsche uses a three-digit (older) or alphanumeric (modern) paint code to identify the exact factory color of every car it builds. The code is stamped on a data plate in the luggage compartment and is permanently recorded in Porsche Classic's archive. It is the single most important piece of documentation for verifying whether a car's current color is original.",
    "For collectors, paint color matters for three reasons. First, original-paint status (verified via paint meter + paint code match) commands a 15–25% premium over an otherwise-identical respray. Second, rare factory colors — Paint-to-Sample (PTS) commissions, special-order hues, limited-production-year shades — command standalone premiums of 10–40% over common colors. Third, incorrect color for the production year or market signals prior repaint and reduces value.",
    "This guide covers where to find the paint code, how to decode it, the most collectible factory colors by generation, how PTS commissions work, and how to protect paint originality in any transaction. It is the canonical MonzaHaus reference on the topic.",
    "Accurate paint authentication requires three things: the factory paint code (from the build plate or Porsche COA), a paint thickness gauge reading (original paint measures 4–6 mils; respray typically 7–12 mils), and visual inspection of hidden panels (door jambs, trunk jamb, engine-bay panels) which are harder to respray cleanly.",
  ],
  sections: [
    {
      heading: "Where to find your Porsche paint code",
      body: [
        "Modern Porsches (1981+): the paint code is printed on the data plate in the front luggage compartment (on 911s, the boot at the nose of the car; on Boxster/Cayman, the rear trunk). The plate is a small aluminum rectangle — look for a line marked 'Lack' or 'Paint' followed by a three-digit number (older) or alphanumeric code (newer). The code also appears on the Porsche Certificate of Authenticity.",
        "Air-cooled era (pre-1996): the code is typically stamped on the driver's-side kickpanel or door jamb sticker. 911 Targa and Cabriolet models may have the code on the engine lid instead. Early 964 and 993 cars occasionally have misprinted or faded stickers — in those cases, Porsche Classic COA is the authoritative fallback.",
        "Water-cooled era (1997+): consolidated on the luggage-compartment data plate. On 996 and later, also encoded in the onboard diagnostic data retrievable via PIWIS or equivalent diagnostic tools at a Porsche-specialist shop.",
      ],
    },
    {
      heading: "Decoding the Porsche paint code",
      body: [
        "Older codes are three-digit numeric (e.g. '024 Grand Prix White'). Modern codes use alphanumeric sequences like '1K1K Riviera Blue'. Some PTS codes start with '9' (e.g. '9K9K' for custom PTS red) and require the Porsche Classic COA to decode because they are not in any public table.",
        "Porsche Classic's Color Archive (available via your regional Porsche Classic Partner) will match any paint code to its factory name and include swatches, binder codes, and basecoat specifications needed for correct respray.",
        "Common collector codes to know: '009' (Black), '024' (Grand Prix White), '036' (Guards Red), '046' (Speed Yellow), '684' (Oak Green Metallic), '22C' (Midnight Blue Metallic), '1A1A' (Miami Blue). Learning the codes for the generation you're shopping is a form of due diligence.",
      ],
    },
    {
      heading: "Most collectible factory colors by generation",
      body: [
        "964 (1989–1994): Rubystone Red (M4M4) is the most-sought, followed by Mint Green (22A), Slate Grey, and Cobalt Blue. Standard Grand Prix White and Guards Red are plentiful. Zermatt Silver on 964 Turbo 3.6 commands a premium.",
        "993 (1995–1998): Riviera Blue (1K), Mint Green (L12H), Lagoon Green (L12D), and Speed Yellow (12H) are the rare 993 collector colors. Guards Red, Silver, and Arctic Silver are common. Midnight Blue Pearl Metallic on 993 Turbo / Turbo S is a recognized premium combination.",
        "996/997: Speed Yellow, Guards Red, Seal Gray, Lapis Blue, Cobalt Blue Metallic, Azure Blue Metallic. Basalt Black on 997 GT3 RS is standard; red or orange aero on white is the iconic 2007 GT3 RS look. PTS commissions start appearing broadly in this era.",
        "991/992: PTS market explodes. Pastel colors (baby blue, mint green, lilac) command premiums. Factory limited-edition colors like 'Heritage Design' Cherry Metallic on Sport Classic are six-figure premium features. 992 Dakar 'Roughroads Rally Design' with two-tone white/blue is iconic.",
      ],
    },
    {
      heading: "Paint-to-Sample (PTS) — what it is, what it costs, how it affects value",
      body: [
        "Paint-to-Sample (PTS) is Porsche's custom paint program — the buyer submits a sample or specifies a custom color, Porsche formulates the paint, and the car is sprayed at Zuffenhausen or Leipzig. Option code M9XXX-series (varies by year). Cost when ordered: $10k–$25k option fee historically; recent 992-era PTS commissions have ranged $15k–$40k.",
        "PTS cars are individually documented in the Porsche Classic archive — the COA will list the PTS code and, often, the original sample color reference. This documentation is what separates a legitimate PTS from a post-sale respray in an unusual color (which has no premium).",
        "Market impact: a documented PTS commission in an interesting color adds 10–30% to collector-variant pricing (911 R, Speedster, GT3 RS). For standard Carrera production, PTS adds less (5–15%) because base cars are already common. For GT3/GT3 RS/Turbo S, PTS is a standalone standalone collector trait — cars are often shopped by color rather than specification.",
      ],
    },
    {
      heading: "Original paint vs respray — how the market values each",
      body: [
        "Original paint (factory finish, undisturbed) is the gold standard. A paint meter (magnetic thickness gauge) reads 4–6 mils on original panels; respray measures 7–12 mils or more depending on quality and number of coats. Concours-grade cars are inspected with a paint meter at every body panel.",
        "Full-car respray in the original factory color is acceptable and adds 5–10% value over a non-original-color respray. Documented respray (known shop, high quality, original color) reduces value by 10–20% vs true original paint. Non-original-color respray reduces value by 20–40%, depending on color appropriateness.",
        "Partial respray (single-panel post-accident repair) is neutral-to-slightly-negative if well-documented. Undocumented partial respray — detectable via paint meter or panel-gap inspection — suggests accident history and must be investigated via body-work records and frame measurements.",
      ],
    },
  ],
  howTo: {
    name: "How to verify Porsche paint originality before buying",
    description:
      "Six-step process to confirm whether a Porsche's current paint is factory-original and matches the documented factory color.",
    steps: [
      {
        name: "Obtain the Porsche Certificate of Authenticity (COA)",
        text: "Request a COA from Porsche Classic (~$150). The COA lists the exact factory paint code. Without this, there is no authoritative reference for what color the car left the factory.",
        url: "https://classic.porsche.com",
      },
      {
        name: "Locate the paint code on the car",
        text: "Check the data plate in the front luggage compartment (modern) or the driver's kickpanel/door jamb (air-cooled). The code on the car must match the COA.",
      },
      {
        name: "Use a paint thickness gauge (paint meter)",
        text: "A magnetic paint meter ($75–$200 tool) reads film thickness in mils. Original paint: 4–6 mils. Respray: 7–12+ mils. Measure every body panel — roof, hood, fenders, doors, quarter panels, trunk lid, bumpers.",
      },
      {
        name: "Inspect hidden panels visually",
        text: "Door jambs, trunk jamb, engine bay panels, A-pillar edges. Hidden panels are harder to respray cleanly. Overspray on rubber seals, undercoating, or wiring indicates respray even if exterior panels look clean.",
      },
      {
        name: "Cross-check with service history",
        text: "Service records may document prior accident repair or elective respray. A missing or suspiciously clean service history on an old car is a red flag; request additional documentation or budget for expert inspection.",
      },
      {
        name: "Factor into negotiation",
        text: "Confirmed original paint: pay the listed premium (10–25% over respray). Documented respray in original color: neutral. Respray in different color: discount 20–40%. Undocumented repaint with prior accident suspected: request body-work records or walk away.",
      },
    ],
  },
  faqs: [
    {
      question: "Where is the paint code on a Porsche?",
      answer:
        "Modern Porsches (1981+): data plate in the front luggage compartment (labeled 'Lack' or 'Paint'). Air-cooled Porsches (pre-1996): driver's-side kickpanel or door jamb sticker. The code also appears on the Porsche Certificate of Authenticity (COA), which is the authoritative fallback if the data plate is missing or illegible.",
    },
    {
      question: "How do I decode a Porsche paint code?",
      answer:
        "Older Porsches use three-digit numeric codes (e.g. '024 Grand Prix White', '036 Guards Red'). Modern Porsches use alphanumeric codes (e.g. '1K1K Riviera Blue'). Porsche Classic's Color Archive (accessible via regional Porsche Classic Partners) will match any code to its factory name. For Paint-to-Sample codes (typically starting with '9'), the Porsche COA is the only authoritative source.",
    },
    {
      question: "How much does original paint add to a Porsche's value?",
      answer:
        "Verified original paint adds 10–25% over an equivalent respray in the original color, and 20–40% over a respray in a different color. For blue-chip collector variants (964 RS, 993 RS, 997 GT3 RS 4.0), the premium can reach 30–50% because concours-grade originality is the expected standard.",
    },
    {
      question: "What is Paint-to-Sample (PTS) Porsche?",
      answer:
        "Paint-to-Sample is Porsche's factory custom paint program. Buyers submit a sample (often a Porsche historic color swatch or a custom specification) and Porsche sprays the car at the factory in that exact shade. PTS cars are documented in the Porsche Classic archive and command premiums of 10–30% over standard paint on collector-variant cars.",
    },
    {
      question: "What are the rarest Porsche colors?",
      answer:
        "By generation: 964 Rubystone Red (M4M4), 964 Mint Green (22A), 993 Riviera Blue (1K), 993 Lagoon Green, 996/997 Cobalt Blue Metallic, 991 Miami Blue (1A1A), 992 Dakar Roughroads two-tone. PTS commissions in pastel or vintage-inspired colors are individually rare. Documented one-off customer-commissioned colors are the rarest — often single-digit production.",
    },
    {
      question: "How can I tell if a Porsche has been repainted?",
      answer:
        "Use a paint thickness gauge (meter): original paint reads 4–6 mils, respray reads 7–12+ mils. Visually inspect door jambs, trunk jamb, and engine-bay panels — respray often misses these. Look for overspray on rubber seals, undercoating, and wiring harnesses. Cross-reference with Porsche COA (factory color) and service history (documented accident/respray records).",
    },
    {
      question: "Does respray in the original color reduce value?",
      answer:
        "Yes, but modestly. Documented professional respray in the factory-original color reduces value by approximately 10–20% versus verified-original paint. A respray in a different color reduces value by 20–40% because it compromises both originality and spec-as-delivered. For blue-chip variants, any respray is a significant negative vs a concours original.",
    },
    {
      question: "Can I order a Porsche in a custom color today?",
      answer:
        "Yes, on most current-production Porsches via the PTS program. Option cost is approximately $15,000–$40,000 depending on model and color complexity. Lead time adds 8–16 weeks to build. PTS is not available on entry-level models like base Boxster, and certain limited-edition models (Sport Classic, Dakar) ship only in their designated colors.",
    },
  ],
  verdict:
    "Paint codes and paint originality are the fastest-learnable, highest-ROI due-diligence items for any Porsche buyer. A $75 paint meter plus a $150 COA will protect a $200k+ transaction from the most common and most expensive form of misrepresentation. Sellers unwilling to document paint status — either original or documented respray — should be discounted accordingly or declined.",
  keywords: [
    "Porsche paint codes",
    "Porsche paint to sample",
    "Porsche PTS",
    "964 paint codes",
    "993 paint codes",
    "911 paint codes",
    "Porsche paint meter",
    "Porsche original paint",
    "Porsche color code lookup",
    "rare Porsche colors",
    "Porsche paint authentication",
    "Porsche respray value",
  ],
};
