// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
// Shared constants used across the Monza Lab application.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Platforms
// ---------------------------------------------------------------------------

export interface PlatformConfig {
  label: string;
  value: string;
  color: string;
  url: string;
  shortName: string;
}

export const PLATFORMS: PlatformConfig[] = [
  {
    label: 'Bring a Trailer',
    value: 'BRING_A_TRAILER',
    color: '#D4A843',
    url: 'https://bringatrailer.com',
    shortName: 'BaT',
  },
  {
    label: 'Cars & Bids',
    value: 'CARS_AND_BIDS',
    color: '#E63946',
    url: 'https://carsandbids.com',
    shortName: 'C&B',
  },
  {
    label: 'Collecting Cars',
    value: 'COLLECTING_CARS',
    color: '#1D3557',
    url: 'https://collectingcars.com',
    shortName: 'CC',
  },
];

// ---------------------------------------------------------------------------
// Popular car makes
// ---------------------------------------------------------------------------

export const MAKES: string[] = [
  'Acura',
  'Alfa Romeo',
  'Aston Martin',
  'Audi',
  'Bentley',
  'BMW',
  'Buick',
  'Cadillac',
  'Chevrolet',
  'Chrysler',
  'Corvette',
  'Datsun',
  'De Tomaso',
  'Dodge',
  'Ferrari',
  'Fiat',
  'Ford',
  'Genesis',
  'GMC',
  'Honda',
  'Infiniti',
  'Jaguar',
  'Jeep',
  'Koenigsegg',
  'Lamborghini',
  'Lancia',
  'Land Rover',
  'Lexus',
  'Lincoln',
  'Lotus',
  'Lucid',
  'Maserati',
  'Mazda',
  'McLaren',
  'Mercedes-Benz',
  'MG',
  'Mini',
  'Mitsubishi',
  'Morgan',
  'Nissan',
  'Oldsmobile',
  'Pagani',
  'Plymouth',
  'Polestar',
  'Pontiac',
  'Porsche',
  'RAM',
  'Range Rover',
  'Rivian',
  'Rolls-Royce',
  'Saab',
  'Shelby',
  'Subaru',
  'Suzuki',
  'Tesla',
  'Toyota',
  'Triumph',
  'TVR',
  'Volkswagen',
  'Volvo',
];

// ---------------------------------------------------------------------------
// Sort options
// ---------------------------------------------------------------------------

export interface SortOption {
  label: string;
  value: string;
  field: string;
  order: 'asc' | 'desc';
}

export const SORT_OPTIONS: SortOption[] = [
  { label: 'Ending Soon', value: 'ending-soon', field: 'endTime', order: 'asc' },
  { label: 'Newly Listed', value: 'newly-listed', field: 'createdAt', order: 'desc' },
  { label: 'Price: Low to High', value: 'price-asc', field: 'currentBid', order: 'asc' },
  { label: 'Price: High to Low', value: 'price-desc', field: 'currentBid', order: 'desc' },
  { label: 'Most Bids', value: 'most-bids', field: 'bidCount', order: 'desc' },
  { label: 'Year: Newest', value: 'year-desc', field: 'year', order: 'desc' },
  { label: 'Year: Oldest', value: 'year-asc', field: 'year', order: 'asc' },
];

// ---------------------------------------------------------------------------
// Default filter state
// ---------------------------------------------------------------------------

export interface FilterState {
  platform: string | null;
  make: string | null;
  model: string | null;
  yearMin: number | null;
  yearMax: number | null;
  priceMin: number | null;
  priceMax: number | null;
  status: string | null;
  search: string;
  sortBy: string;
}

export const DEFAULT_FILTERS: FilterState = {
  platform: null,
  make: null,
  model: null,
  yearMin: null,
  yearMax: null,
  priceMin: null,
  priceMax: null,
  status: null,
  search: '',
  sortBy: 'ending-soon',
};

// ---------------------------------------------------------------------------
// Investment grade display configuration
// ---------------------------------------------------------------------------

export interface GradeConfig {
  label: string;
  color: string;
  bgColor: string;
  description: string;
}

export const INVESTMENT_GRADE_COLORS: Record<string, GradeConfig> = {
  EXCELLENT: {
    label: 'Excellent',
    color: '#16A34A',
    bgColor: '#F0FDF4',
    description: 'Strong investment potential with high collectibility',
  },
  GOOD: {
    label: 'Good',
    color: '#2563EB',
    bgColor: '#EFF6FF',
    description: 'Solid value with moderate appreciation potential',
  },
  FAIR: {
    label: 'Fair',
    color: '#D97706',
    bgColor: '#FFFBEB',
    description: 'Average value retention, limited appreciation expected',
  },
  SPECULATIVE: {
    label: 'Speculative',
    color: '#DC2626',
    bgColor: '#FEF2F2',
    description: 'Uncertain value trajectory, buy for enjoyment',
  },
  // Alternative letter grades
  A: {
    label: 'A',
    color: '#16A34A',
    bgColor: '#F0FDF4',
    description: 'Strong investment potential',
  },
  B: {
    label: 'B',
    color: '#2563EB',
    bgColor: '#EFF6FF',
    description: 'Solid value proposition',
  },
  C: {
    label: 'C',
    color: '#D97706',
    bgColor: '#FFFBEB',
    description: 'Average value retention',
  },
  D: {
    label: 'D',
    color: '#EA580C',
    bgColor: '#FFF7ED',
    description: 'Below average outlook',
  },
  F: {
    label: 'F',
    color: '#DC2626',
    bgColor: '#FEF2F2',
    description: 'Poor investment outlook',
  },
};

// ---------------------------------------------------------------------------
// Market trend display configuration
// ---------------------------------------------------------------------------

export interface TrendConfig {
  label: string;
  icon: string;
  color: string;
}

export const MARKET_TREND_ICONS: Record<string, TrendConfig> = {
  APPRECIATING: {
    label: 'Appreciating',
    icon: '\u2191',   // up arrow
    color: '#16A34A',
  },
  STABLE: {
    label: 'Stable',
    icon: '\u2192',   // right arrow
    color: '#D97706',
  },
  DECLINING: {
    label: 'Declining',
    icon: '\u2193',   // down arrow
    color: '#DC2626',
  },
  strong_up: {
    label: 'Strong Up',
    icon: '\u21D1',   // double up arrow
    color: '#15803D',
  },
  up: {
    label: 'Up',
    icon: '\u2191',
    color: '#16A34A',
  },
  stable: {
    label: 'Stable',
    icon: '\u2192',
    color: '#D97706',
  },
  down: {
    label: 'Down',
    icon: '\u2193',
    color: '#DC2626',
  },
  strong_down: {
    label: 'Strong Down',
    icon: '\u21D3',   // double down arrow
    color: '#991B1B',
  },
};

// ---------------------------------------------------------------------------
// Misc constants
// ---------------------------------------------------------------------------

/** Analysis results are cached for this duration before re-analysis. */
export const ANALYSIS_CACHE_HOURS = 24;

/** Maximum number of auctions to display per page. */
export const PAGE_SIZE = 20;

/** Supported auction statuses for filtering. */
export const AUCTION_STATUSES = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Ending Soon', value: 'ENDING_SOON' },
  { label: 'Sold / Ended', value: 'ENDED' },
  { label: 'Sold', value: 'SOLD' },
  { label: 'No Sale', value: 'NO_SALE' },
] as const;

/** Year range for the year filter. */
export const YEAR_RANGE = {
  min: 1920,
  max: new Date().getFullYear() + 1,
} as const;

/** Price preset ranges for quick filtering. */
export const PRICE_RANGES = [
  { label: 'Under $10K', min: 0, max: 10000 },
  { label: '$10K - $25K', min: 10000, max: 25000 },
  { label: '$25K - $50K', min: 25000, max: 50000 },
  { label: '$50K - $100K', min: 50000, max: 100000 },
  { label: '$100K - $250K', min: 100000, max: 250000 },
  { label: '$250K+', min: 250000, max: null },
] as const;
