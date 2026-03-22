// ─── MOCK DATA FOR BRAND-LEVEL INSIGHTS ───
export const brandThesis: Record<string, string> = {
  Porsche: "Porsche represents the pinnacle of driver engagement and investment potential. Air-cooled models (pre-1998) remain the most sought-after in the collector market, with the 993 generation commanding particular interest. The brand's motorsport heritage and limited production of special models ensures sustained collector demand.",
  Ferrari: "Ferrari's collector car segment demonstrates remarkable resilience. The brand's strict production limits and heritage continue to drive demand across all eras. Classiche certification is essential—non-certified cars trade at 15-20% discounts.",
  McLaren: "McLaren F1 stands alone as the greatest supercar ever made. Central driving position, gold-lined engine bay, 240 mph top speed. Only 64 road cars built—the ultimate trophy asset. Among the most coveted assets in the collector car world, with consistent demand at auction.",
  Lamborghini: "Lamborghini's poster-car icons from the 70s and 80s represent pure automotive artistry. The Miura created the supercar template, while the Countach defined a generation's dreams. Both continue to appreciate as blue-chip collectibles.",
  Nissan: "JDM vehicles are experiencing unprecedented demand as 25-year import eligibility expands the collector base. The R34 GT-R represents peak Japanese engineering, with V-Spec models commanding premium prices.",
  Toyota: "The A80 Supra has achieved icon status, bolstered by Fast & Furious cultural prominence and bulletproof 2JZ reliability. 6-speed manual turbo in stock condition is increasingly rare and highly sought after.",
  "Mercedes-Benz": "The 300SL Gullwing remains the world's first supercar. Revolutionary fuel injection made it the fastest production car of 1955. Iconic gullwing doors ensure eternal desirability and museum-quality investment potential.",
  "Aston Martin": "The DB5 is the most famous car in cinema history. James Bond's weapon of choice ensures perpetual collector demand. British craftsmanship and timeless design make it a cornerstone of any serious collection.",
  Lexus: "The LFA represents the pinnacle of Japanese engineering. Yamaha-designed V10 revs to 9,000 RPM. Only 500 produced worldwide. Hand-built perfection that will only appreciate as ICE supercars become extinct.",
  Ford: "The Ford GT is the ultimate homage to Le Mans glory. Supercharged V8, mid-engine layout, hand-built quality. American supercar renaissance leader with strong investment fundamentals.",
  BMW: "BMW's M division has created some of the most collectible driver's cars. From the E30 M3 to the 3.0 CSL, these machines combine motorsport DNA with everyday usability. Limited editions and special variants command significant premiums.",
  Acura: "The NSX was developed with Senna's input to create the everyday supercar. NA1 with pop-up headlights is most desirable. Legendary Honda reliability meets exotic performance.",
  Jaguar: "Enzo Ferrari called the E-Type 'the most beautiful car ever made.' Series 1 with covered headlights is the most desirable specification. Timeless British elegance at accessible price points.",
  default: "Investment-grade collector vehicles with strong collector market fundamentals and documented provenance.",
}

export const brandStrategy: Record<string, { advice: string; complexity: string; liquidity: string }> = {
  Porsche: { advice: "Focus on low-mileage, documented examples with factory options. PTS cars and limited editions command 20-30% premiums.", complexity: "Moderate", liquidity: "High" },
  Ferrari: { advice: "Classiche certification is essential. Engage marque specialist for pre-purchase inspection. Service history documentation critical.", complexity: "High", liquidity: "High" },
  McLaren: { advice: "Full McLaren service history mandatory. Central seat position requires specialist knowledge. Trophy asset for serious collectors only.", complexity: "Very High", liquidity: "Low" },
  Lamborghini: { advice: "Polo Storico certification adds significant value. Concours condition examples trade at substantial premiums.", complexity: "High", liquidity: "Moderate" },
  BMW: { advice: "Focus on low-production M variants. CSL, GTS, and CS models appreciate fastest. Original paint and documented service history add 15-20% premium.", complexity: "Moderate", liquidity: "High" },
  Nissan: { advice: "Verify legal import status and EPA/DOT compliance. Stock, unmodified examples increasingly rare and valuable.", complexity: "Moderate", liquidity: "High" },
  Toyota: { advice: "Original window sticker and service records essential. 6-speed manual commands significant premium over automatic.", complexity: "Low", liquidity: "Very High" },
  default: { advice: "Prioritize documented history and matching numbers. Manual transmissions command 15-20% premiums over automatics.", complexity: "Moderate", liquidity: "Moderate" },
}

export const ownershipCosts: Record<string, { insurance: number; storage: number; maintenance: number }> = {
  McLaren: { insurance: 45000, storage: 12000, maintenance: 25000 },
  Porsche: { insurance: 8500, storage: 6000, maintenance: 8000 },
  Ferrari: { insurance: 18000, storage: 8000, maintenance: 15000 },
  Lamborghini: { insurance: 15000, storage: 8000, maintenance: 12000 },
  BMW: { insurance: 4500, storage: 4200, maintenance: 5000 },
  Nissan: { insurance: 4500, storage: 3600, maintenance: 3500 },
  Toyota: { insurance: 3200, storage: 3600, maintenance: 2500 },
  "Mercedes-Benz": { insurance: 6500, storage: 4800, maintenance: 6000 },
  "Aston Martin": { insurance: 8000, storage: 6000, maintenance: 10000 },
  Lexus: { insurance: 6000, storage: 4800, maintenance: 4500 },
  Ford: { insurance: 5500, storage: 4200, maintenance: 4000 },
  Acura: { insurance: 3000, storage: 3600, maintenance: 2800 },
  Jaguar: { insurance: 4500, storage: 4200, maintenance: 5000 },
  default: { insurance: 5000, storage: 4800, maintenance: 5000 },
}

// ─── MOCK MARKET DEPTH (per brand) ───
export const mockMarketDepth: Record<string, { auctionsPerYear: number; avgDaysToSell: number; sellThroughRate: number; demandScore: number }> = {
  Porsche: { auctionsPerYear: 340, avgDaysToSell: 12, sellThroughRate: 89, demandScore: 9 },
  Ferrari: { auctionsPerYear: 180, avgDaysToSell: 18, sellThroughRate: 82, demandScore: 9 },
  McLaren: { auctionsPerYear: 15, avgDaysToSell: 45, sellThroughRate: 72, demandScore: 7 },
  Lamborghini: { auctionsPerYear: 95, avgDaysToSell: 22, sellThroughRate: 78, demandScore: 8 },
  BMW: { auctionsPerYear: 280, avgDaysToSell: 14, sellThroughRate: 85, demandScore: 8 },
  Nissan: { auctionsPerYear: 120, avgDaysToSell: 8, sellThroughRate: 94, demandScore: 9 },
  Toyota: { auctionsPerYear: 85, avgDaysToSell: 6, sellThroughRate: 96, demandScore: 10 },
  "Mercedes-Benz": { auctionsPerYear: 150, avgDaysToSell: 20, sellThroughRate: 80, demandScore: 7 },
  "Aston Martin": { auctionsPerYear: 60, avgDaysToSell: 28, sellThroughRate: 75, demandScore: 7 },
  Lexus: { auctionsPerYear: 25, avgDaysToSell: 15, sellThroughRate: 88, demandScore: 8 },
  Ford: { auctionsPerYear: 45, avgDaysToSell: 18, sellThroughRate: 82, demandScore: 7 },
  Acura: { auctionsPerYear: 35, avgDaysToSell: 10, sellThroughRate: 90, demandScore: 8 },
  Jaguar: { auctionsPerYear: 70, avgDaysToSell: 25, sellThroughRate: 76, demandScore: 6 },
  default: { auctionsPerYear: 80, avgDaysToSell: 20, sellThroughRate: 78, demandScore: 7 },
}

// ─── PRICE RANGE OPTIONS ───
export const priceRanges = [
  { label: "All Prices", min: 0, max: Infinity },
  { label: "Under $100K", min: 0, max: 100000 },
  { label: "$100K - $250K", min: 100000, max: 250000 },
  { label: "$250K - $500K", min: 250000, max: 500000 },
  { label: "$500K - $1M", min: 500000, max: 1000000 },
  { label: "$1M - $5M", min: 1000000, max: 5000000 },
  { label: "$5M+", min: 5000000, max: Infinity },
]

// ─── SORT OPTIONS ───
export const sortOptions = [
  { key: "priceHighToLow" as const, value: "price-desc" },
  { key: "priceLowToHigh" as const, value: "price-asc" },
  { key: "yearNewestFirst" as const, value: "year-desc" },
  { key: "yearOldestFirst" as const, value: "year-asc" },
  { key: "mostListed" as const, value: "count-desc" },
]

// Sort options for individual car feed (no "most listed")
export const carSortOptions = [
  { key: "priceHighToLow" as const, value: "price-desc" },
  { key: "priceLowToHigh" as const, value: "price-asc" },
  { key: "yearNewestFirst" as const, value: "year-desc" },
  { key: "yearOldestFirst" as const, value: "year-asc" },
]

export const SORT_LABELS: Record<string, string> = {
  "price-desc": "Precio ↓",
  "price-asc": "Precio ↑",
  "year-desc": "Año ↓",
  "year-asc": "Año ↑",
  "count-desc": "Cantidad",
}

// ─── PLATFORM LABELS ───
export const platformLabels: Record<string, { short: string; color: string }> = {
  BRING_A_TRAILER: { short: "BaT", color: "bg-amber-500/20 text-amber-400" },
  CARS_AND_BIDS: { short: "C&B", color: "bg-blue-500/20 text-blue-400" },
  COLLECTING_CARS: { short: "CC", color: "bg-purple-500/20 text-purple-400" },
  AUTO_SCOUT_24: { short: "AS24", color: "bg-green-500/20 text-green-400" },
  RM_SOTHEBYS: { short: "RM", color: "bg-rose-500/20 text-rose-400" },
  GOODING: { short: "Gooding", color: "bg-emerald-500/20 text-emerald-400" },
  BONHAMS: { short: "Bonhams", color: "bg-cyan-500/20 text-cyan-400" },
  AUTO_TRADER: { short: "AutoTrader", color: "bg-orange-500/20 text-orange-400" },
  BE_FORWARD: { short: "BeForward", color: "bg-teal-500/20 text-teal-400" },
  CLASSIC_COM: { short: "Classic.com", color: "bg-indigo-500/20 text-indigo-400" },
  ELFERSPOT: { short: "Elferspot", color: "bg-yellow-500/20 text-yellow-400" },
}

// ─── AUCTION vs MARKETPLACE DISTINCTION ───
// Only these platforms run time-limited auctions with bidding.
// Everything else is a fixed-price marketplace listing.
const AUCTION_PLATFORMS = new Set([
  "BRING_A_TRAILER",
  "CARS_AND_BIDS",
  "COLLECTING_CARS",
  "RM_SOTHEBYS",
  "GOODING",
  "BONHAMS",
])

/** Returns true if the platform is an auction house (has bids, time-limited). */
export function isAuctionPlatform(platform?: string | null): boolean {
  return !!platform && AUCTION_PLATFORMS.has(platform)
}

/** Smart price label: "Current Bid" for live auctions, "Sold for" for ended auctions, "Price" for marketplace. */
export function getPriceLabel(platform?: string | null, status?: string | null): string {
  if (isAuctionPlatform(platform)) {
    return status === "ENDED" ? "Sold for" : "Current Bid"
  }
  return status === "ENDED" ? "Last Listed" : "Price"
}

/** Smart status label: "Ended" for auctions, "Sold" for ended marketplace, "For Sale" for active marketplace. */
export function getStatusLabel(platform?: string | null, status?: string | null): string {
  if (isAuctionPlatform(platform)) {
    if (status === "ENDED") return "Ended"
    if (status === "ENDING_SOON") return "Ending Soon"
    return "Live"
  }
  return status === "ENDED" ? "Sold" : "For Sale"
}

/** Platform display name — human-readable, never "Auction" as fallback. */
export function getPlatformName(platform?: string | null): string {
  if (!platform) return "Listing"
  return platformLabels[platform]?.short ?? platform.replace(/_/g, " ")
}

// ─── REGION FLAG LABELS ───
export const regionLabels: Record<string, { flag: string; short: string }> = {
  US: { flag: "\u{1F1FA}\u{1F1F8}", short: "US" },
  EU: { flag: "\u{1F1EA}\u{1F1FA}", short: "EU" },
  UK: { flag: "\u{1F1EC}\u{1F1E7}", short: "UK" },
  JP: { flag: "\u{1F1EF}\u{1F1F5}", short: "JP" },
}

// ─── GENERATIONS BY FAMILY ───
export const GENERATIONS_BY_FAMILY: Record<string, Array<{ id: string; label: string }>> = {
  "911": [
    { id: "992", label: "992 (2019+)" },
    { id: "991", label: "991 (2011-2019)" },
    { id: "997", label: "997 (2004-2012)" },
    { id: "996", label: "996 (1997-2005)" },
    { id: "993", label: "993 (1993-1998)" },
    { id: "964", label: "964 (1989-1994)" },
    { id: "930", label: "930 (1975-1989)" },
    { id: "g-model", label: "G-Model (1974-1989)" },
    { id: "f-model", label: "F-Model (1963-1973)" },
  ],
  "Cayenne": [
    { id: "e3", label: "E3 (2019-2024)" },
    { id: "e2", label: "E2 (2011-2018)" },
    { id: "e1", label: "E1 (2003-2010)" },
  ],
  "Taycan": [
    { id: "j1", label: "J1 (2020+)" },
  ],
  "Macan": [
    { id: "95b-2", label: "95B.2 (2024+)" },
    { id: "95b", label: "95B (2019-2024)" },
    { id: "95b-1", label: "95B.1 (2014-2018)" },
  ],
  "Panamera": [
    { id: "g3", label: "G3 (2024+)" },
    { id: "g2", label: "G2 (2017-2024)" },
    { id: "g1", label: "G1 (2010-2016)" },
  ],
  "Boxster": [
    { id: "718", label: "718 (2016+)" },
    { id: "981", label: "981 (2012-2016)" },
    { id: "987", label: "987 (2005-2012)" },
  ],
  "Cayman": [
    { id: "718", label: "718 (2016+)" },
    { id: "981", label: "981 (2012-2016)" },
    { id: "987", label: "987 (2005-2012)" },
  ],
  "356": [
    { id: "356c", label: "356C (1963-1965)" },
    { id: "356b", label: "356B (1959-1963)" },
    { id: "356a", label: "356A (1955-1959)" },
    { id: "356-pre-a", label: "Pre-A (1948-1955)" },
  ],
  "928": [
    { id: "928-gts", label: "GTS (1992-1995)" },
    { id: "928-gt", label: "GT (1989-1991)" },
    { id: "928-s4", label: "S4 (1987-1991)" },
    { id: "928-s2", label: "S/S2 (1980-1986)" },
    { id: "928-base", label: "Base (1978-1982)" },
  ],
  "944": [
    { id: "944-s2", label: "S2 (1989-1991)" },
    { id: "944-turbo", label: "Turbo (1985-1991)" },
    { id: "944-s", label: "S (1987-1988)" },
    { id: "944-base", label: "Base (1982-1988)" },
  ],
  "968": [
    { id: "968-cs", label: "Club Sport (1993-1995)" },
    { id: "968-turbo-s", label: "Turbo S (1993-1994)" },
    { id: "968-base", label: "Base (1992-1995)" },
  ],
  "914": [
    { id: "914-2.0", label: "2.0L (1973-1976)" },
    { id: "914-1.8", label: "1.8L (1970-1972)" },
    { id: "914-1.7", label: "1.7L (1969-1973)" },
  ],
  "924": [
    { id: "924-carrera-gt", label: "Carrera GT (1980-1981)" },
    { id: "924-s", label: "S (1986-1988)" },
    { id: "924-turbo", label: "Turbo (1979-1984)" },
    { id: "924-base", label: "Base (1976-1988)" },
  ],
  "Carrera GT": [
    { id: "980", label: "980 (2004-2007)" },
  ],
  "918 Spyder": [
    { id: "918", label: "918 (2013-2015)" },
  ],
  "718": [
    { id: "718-rsk", label: "RSK (1957-1958)" },
    { id: "718-w-rs", label: "W-RS (1961-1962)" },
    { id: "718-classic", label: "718/2 (1959-1960)" },
  ],
}
