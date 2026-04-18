export type StatusFilter = "all" | "live" | "sold";

export type SortOption =
  | "newest"
  | "priceDesc"
  | "priceAsc"
  | "endingSoon"
  | "yearDesc"
  | "yearAsc"
  | "mileageAsc";

export type ClassicFilters = {
  q: string;
  series: string[];
  variants: string[];
  yearMin: number | null;
  yearMax: number | null;
  priceMin: number | null;
  priceMax: number | null;
  mileageMin: number | null;
  mileageMax: number | null;
  transmission: string[];
  body: string[];
  region: string[];
  drive: string[];
  steering: string[];
  platform: string[];
  status: StatusFilter;
  sort: SortOption;
};

export const EMPTY_FILTERS: ClassicFilters = {
  q: "",
  series: [],
  variants: [],
  yearMin: null,
  yearMax: null,
  priceMin: null,
  priceMax: null,
  mileageMin: null,
  mileageMax: null,
  transmission: [],
  body: [],
  region: [],
  drive: [],
  steering: [],
  platform: [],
  status: "all",
  sort: "newest",
};

export const YEAR_BOUNDS = { min: 1948, max: 2026 } as const;
export const PRICE_BOUNDS = { min: 0, max: 2_000_000 } as const;
export const MILEAGE_BOUNDS = { min: 0, max: 300_000 } as const;

export const TRANSMISSION_OPTIONS = [
  { id: "manual", label: "Manual", keywords: ["manual", "m/t", "mt"] },
  { id: "pdk", label: "PDK", keywords: ["pdk"] },
  { id: "automatic", label: "Automatic", keywords: ["automatic", "tiptronic", "a/t", "auto"] },
] as const;

export const BODY_OPTIONS = [
  { id: "Coupe", label: "Coupe" },
  { id: "Convertible", label: "Cabriolet" },
  { id: "Targa", label: "Targa" },
  { id: "Speedster", label: "Speedster" },
  { id: "SUV", label: "SUV" },
  { id: "Sedan", label: "Sedan" },
  { id: "Wagon", label: "Sport Turismo" },
] as const;

export const REGION_OPTIONS = [
  { id: "US", label: "United States" },
  { id: "UK", label: "United Kingdom" },
  { id: "EU", label: "Europe" },
  { id: "JP", label: "Japan" },
] as const;

export const DRIVE_OPTIONS = [
  { id: "rwd", label: "Rear-wheel drive", keywords: ["rwd", "rear-wheel", "rear wheel"] },
  { id: "awd", label: "All-wheel drive", keywords: ["awd", "all-wheel", "all wheel", "4wd", "4s", "turbo"] },
] as const;

export const STEERING_OPTIONS = [
  { id: "lhd", label: "Left-hand drive" },
  { id: "rhd", label: "Right-hand drive" },
] as const;

export const PLATFORM_OPTIONS = [
  { id: "BRING_A_TRAILER", label: "Bring a Trailer" },
  { id: "CARS_AND_BIDS", label: "Cars & Bids" },
  { id: "COLLECTING_CARS", label: "Collecting Cars" },
  { id: "ELFERSPOT", label: "Elferspot" },
  { id: "CLASSIC_COM", label: "Classic.com" },
  { id: "AUTO_SCOUT_24", label: "AutoScout24" },
  { id: "AUTO_TRADER", label: "AutoTrader" },
  { id: "BE_FORWARD", label: "BeForward" },
  { id: "RM_SOTHEBYS", label: "RM Sotheby's" },
  { id: "BONHAMS", label: "Bonhams" },
  { id: "GOODING", label: "Gooding & Co." },
] as const;

export function countActiveFilters(f: ClassicFilters): number {
  let n = 0;
  if (f.q) n++;
  if (f.series.length) n++;
  if (f.variants.length) n++;
  if (f.yearMin !== null || f.yearMax !== null) n++;
  if (f.priceMin !== null || f.priceMax !== null) n++;
  if (f.mileageMin !== null || f.mileageMax !== null) n++;
  if (f.transmission.length) n++;
  if (f.body.length) n++;
  if (f.region.length) n++;
  if (f.drive.length) n++;
  if (f.steering.length) n++;
  if (f.platform.length) n++;
  if (f.status !== "all") n++;
  return n;
}
