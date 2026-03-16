export const platformShort: Record<string, string> = {
  BRING_A_TRAILER: "BaT",
  RM_SOTHEBYS: "RM",
  GOODING: "G&C",
  BONHAMS: "BON",
  CARS_AND_BIDS: "C&B",
  COLLECTING_CARS: "CC",
  AUTO_SCOUT_24: "AS24",
  AUTO_TRADER: "AT",
  BE_FORWARD: "BF",
  CLASSIC_COM: "Cls",
}

// ─── UNIVERSAL MOCK DATA ───
// This ensures EVERY car shows rich data in the Context Panel
export const mockWhyBuy: Record<string, string> = {
  McLaren: "The McLaren F1 represents the pinnacle of analog supercar engineering. Extreme scarcity with only 64 road cars ensures lasting collector interest and consistent auction presence.",
  Porsche: "The 911 Carrera RS 2.7 is the foundation of Porsche's motorsport legacy. As the first homologation special, it carries historical significance that transcends typical collector car metrics. Strong club support and cross-generational appeal make this a cornerstone holding.",
  Ferrari: "Ferrari's timeless design combined with the legendary Colombo V12 creates an investment-grade asset. Classiche certification ensures authenticity. This model has demonstrated remarkable price stability even during market corrections.",
  Lamborghini: "Lamborghini's first true supercar remains the most desirable variant. Polo Storico certification adds provenance value. The mid-engine layout influenced every supercar that followed, cementing its historical importance.",
  Nissan: "The R34 GT-R represents the peak of Japanese engineering excellence. With 25-year import eligibility now active in the US, demand continues to grow as 25-year import eligibility expands the collector base. Low production numbers and strong enthusiast community support lasting value.",
  Toyota: "The A80 Supra has achieved icon status, bolstered by pop culture prominence and bulletproof 2JZ reliability. Clean, stock examples are increasingly rare as many were modified. Turbo 6-speed variants command significant premiums.",
  BMW: "The E30 M3 is widely regarded as the quintessential driver's car. Motorsport heritage and timeless design ensure lasting desirability. Sport Evolution and lightweight variants show strongest collector demand.",
  Mercedes: "Mercedes-Benz classics combine engineering excellence with timeless elegance. Strong parts availability and active restoration community support long-term ownership. Coupe and Cabriolet variants show strongest appreciation.",
  "Aston Martin": "The quintessential British grand tourer. James Bond association ensures global recognition. Strong club support and active restoration community. DB-series cars show consistent appreciation and strong auction presence.",
  Jaguar: "British elegance meets Le Mans-winning pedigree. The XJ220 was underappreciated for decades but collector interest is growing as the market recognizes its engineering significance.",
  Mazda: "The RX-7 FD represents the pinnacle of rotary engine development. Spirit R editions are especially collectible. As the final true rotary sports car, scarcity supports strong collector value.",
  Honda: "Honda's engineering excellence shines in the S2000. The F20C/F22C engines are legendary for their 9,000 RPM redline. CR variants command significant premiums for their track-focused specification.",
  Shelby: "Carroll Shelby's Cobra is the ultimate American sports car legend. 427 examples represent the pinnacle of analog performance. CSX-documented cars command top dollar at auction.",
  Chevrolet: "The C2 Corvette Stingray is America's sports car at its most beautiful. Big block variants with manual transmissions are the collector's choice. Strong club support ensures lasting value.",
  Bugatti: "The EB110 represents Bugatti's modern renaissance. Quad-turbo V12, carbon chassis, and AWD were revolutionary for 1991. With only 139 built, scarcity drives strong appreciation.",
  Lancia: "The Stratos is the most successful rally car ever, dominating World Rally Championship from 1974-1976. Ferrari Dino V6 power and Bertone design ensure eternal collector appeal.",
  "De Tomaso": "Italian design meets American V8 power. The Mangusta's Giugiaro styling and rare production numbers make it an undervalued blue chip. Recognition is growing among serious collectors.",
  Alpine: "The A110 is France's answer to the Porsche 911. Lightweight, agile, and proven in competition. The 1600S is the ultimate road specification. Values rising as recognition spreads globally.",
  default: "This vehicle represents a compelling opportunity in the collector car market. Strong fundamentals, limited production, and growing collector interest suggest strong collector market presence.",
}

export const REGION_FLAGS: Record<string, string> = { US: "\u{1F1FA}\u{1F1F8}", UK: "\u{1F1EC}\u{1F1E7}", EU: "\u{1F1EA}\u{1F1FA}", JP: "\u{1F1EF}\u{1F1F5}" }

export const REGION_LABEL_KEYS = {
  US: "brandContext.regionUS",
  UK: "brandContext.regionUK",
  EU: "brandContext.regionEU",
  JP: "brandContext.regionJP",
} as const
