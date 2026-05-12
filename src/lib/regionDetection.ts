import type { Region } from "@/lib/curatedCars";

type RegionPattern = {
  region: Region;
  patterns: RegExp[];
};

// Each pattern is matched against the lowercased, accent-stripped message.
// Patterns use word boundaries so "us" in "trust" won't false-trigger.
// Order: EU/UK/JP first (more specific), US last (broad).
const REGION_PATTERNS: RegionPattern[] = [
  {
    region: "UK",
    patterns: [
      /\b(united kingdom|great britain|britain|england|scotland|wales|northern ireland)\b/,
      /\b(uk|gb)\b/,
      /\b(london|manchester|edinburgh|glasgow|birmingham|liverpool)\b/,
      /\b(vereinigtes konigreich|grossbritannien|england|schottland|wales)\b/,
      /\b(reino unido|gran bretana|inglaterra|escocia|gales)\b/,
      /\b(イギリス|英国|ロンドン)\b/,
    ],
  },
  {
    region: "JP",
    patterns: [
      /\b(japan|japanese)\b/,
      /\b(jp|jpn)\b/,
      /\b(tokyo|osaka|kyoto|yokohama|nagoya)\b/,
      /\b(japon|japones)\b/,
      /\b(日本|東京|大阪|京都)\b/,
    ],
  },
  {
    region: "EU",
    patterns: [
      /\b(europe|european union|eu|eurozone)\b/,
      /\b(germany|deutschland|french|france|spain|italy|netherlands|belgium|austria|portugal|denmark|sweden|norway|finland|switzerland|ireland|poland|czech)\b/,
      /\b(berlin|munich|munchen|hamburg|frankfurt|stuttgart|cologne|koln|paris|lyon|marseille|madrid|barcelona|rome|milan|amsterdam|brussels|vienna|wien|lisbon|copenhagen|stockholm|oslo|helsinki|zurich|geneva|dublin|warsaw|prague)\b/,
      /\b(europa|alemania|aleman|alemana|frances|francesa|espana|espanol|italia|italiano|holanda|belgica|austria|portugal|dinamarca|suecia|noruega|finlandia|suiza|irlanda|polonia)\b/,
      /\b(europaisch|deutsch|deutsche|deutschland|franzosisch|spanisch|italienisch|niederlande|niederlandisch|belgien|osterreich|portugal|danemark|schweden|norwegen|finnland|schweiz|irland|polen)\b/,
      /\b(ヨーロッパ|欧州|ドイツ|フランス|スペイン|イタリア|オランダ|ベルギー|オーストリア|ポルトガル|スイス)\b/,
    ],
  },
  {
    region: "US",
    patterns: [
      /\b(united states|america|american|stateside)\b/,
      /\b(us|usa)\b/,
      /\b(new york|nyc|los angeles|la|san francisco|sf|chicago|miami|texas|california|florida|seattle|boston|atlanta)\b/,
      /\b(estados unidos|norteamerica|americano|americana)\b/,
      /\b(vereinigte staaten|amerika|amerikanisch)\b/,
      /\b(米国|アメリカ|ニューヨーク|ロサンゼルス|サンフランシスコ)\b/,
    ],
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Scan a free-text message for explicit country/region mentions.
 * Returns the first region matched, or null if no region is detected.
 * Locale-agnostic: handles EN/DE/ES/JA terms in the same pass.
 */
export function detectRegionFromMessage(text: string): Region | null {
  if (!text || text.length === 0) return null;
  const normalized = normalize(text);
  for (const { region, patterns } of REGION_PATTERNS) {
    if (patterns.some((p) => p.test(normalized))) {
      return region;
    }
  }
  return null;
}

export const REGION_DETECTION_INTERNAL = {
  normalize,
  REGION_PATTERNS,
};
