// ---------------------------------------------------------------------------
// Utility Formatters
// ---------------------------------------------------------------------------
// Formatting helpers for currency, numbers, dates, and platform display.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/**
 * Format a number with comma separators: 1,234,567
 */
export function formatNumber(num: number | null | undefined): string {
  if (num == null) return '--';
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Format a large number with abbreviation: 1.2M, 45K, etc.
 */
export function formatCompactNumber(num: number | null | undefined): string {
  if (num == null) return '--';

  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num);
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * Format a date as a readable string: "Jan 15, 2025"
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '--';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '--';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

/**
 * Format a date with time: "Jan 15, 2025 3:42 PM"
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '--';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '--';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Format relative date: "2 hours ago", "3 days ago", "just now"
 */
export function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return '--';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '--';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return formatDate(d);
}

// ---------------------------------------------------------------------------
// Time remaining (countdown)
// ---------------------------------------------------------------------------

/**
 * Format time remaining until an end time.
 * Returns human-readable countdown: "2d 5h", "3h 22m", "ending soon", "ended"/"sold"
 * @param endedLabel — custom label for expired items (e.g. "Sold" for listings, "Ended" for auctions)
 */
export function formatTimeRemaining(endTime: Date | string | null | undefined, endedLabel?: string): string {
  if (!endTime) return '--';

  const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
  if (isNaN(end.getTime())) return '--';

  const now = new Date();
  const diffMs = end.getTime() - now.getTime();

  // Already ended
  if (diffMs <= 0) return endedLabel ?? 'ended';

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Less than 5 minutes
  if (totalSeconds < 300) {
    return 'ending soon';
  }

  // Less than 1 hour
  if (totalSeconds < 3600) {
    return `${minutes}m ${seconds}s`;
  }

  // Less than 1 day
  if (days === 0) {
    return `${hours}h ${minutes}m`;
  }

  // 1+ days
  if (days === 1) {
    return `1d ${hours}h`;
  }

  return `${days}d ${hours}h`;
}

// ---------------------------------------------------------------------------
// Mileage
// ---------------------------------------------------------------------------

/**
 * Format mileage: "45,230 miles" or "12,500 km"
 */
export function formatMileage(
  miles: number | null | undefined,
  unit: string = 'miles',
): string {
  if (miles == null) return 'Not specified';

  const formatted = formatNumber(miles);
  return `${formatted} ${unit}`;
}

// ---------------------------------------------------------------------------
// Platform display
// ---------------------------------------------------------------------------

type PlatformKey =
  | 'BRING_A_TRAILER'
  | 'CARS_AND_BIDS'
  | 'COLLECTING_CARS'
  | 'bringatrailer'
  | 'carsandbids'
  | 'collectingcars';

const PLATFORM_LABELS: Record<string, string> = {
  BRING_A_TRAILER: 'Bring a Trailer',
  CARS_AND_BIDS: 'Cars & Bids',
  COLLECTING_CARS: 'Collecting Cars',
  bringatrailer: 'Bring a Trailer',
  carsandbids: 'Cars & Bids',
  collectingcars: 'Collecting Cars',
};

const PLATFORM_COLORS: Record<string, string> = {
  BRING_A_TRAILER: '#D4A843',   // BaT gold
  CARS_AND_BIDS: '#E63946',     // C&B red
  COLLECTING_CARS: '#1D3557',   // CC navy blue
  bringatrailer: '#D4A843',
  carsandbids: '#E63946',
  collectingcars: '#1D3557',
};

/**
 * Get a human-readable label for a platform identifier.
 */
export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] || platform;
}

/**
 * Get the brand color (hex) for a platform.
 */
export function platformColor(platform: string): string {
  return PLATFORM_COLORS[platform] || '#6B6365';
}

// ---------------------------------------------------------------------------
// Investment grade display
// ---------------------------------------------------------------------------

/**
 * Get a color for an investment grade.
 */
export function investmentGradeColor(grade: string): string {
  switch (grade?.toUpperCase()) {
    case 'EXCELLENT':
    case 'A':
      return '#16A34A'; // green
    case 'GOOD':
    case 'B':
      return '#2563EB'; // blue
    case 'FAIR':
    case 'C':
      return '#D97706'; // amber
    case 'SPECULATIVE':
    case 'D':
    case 'F':
      return '#DC2626'; // red
    default:
      return '#6B6365'; // gray
  }
}

// ---------------------------------------------------------------------------
// Market trend display
// ---------------------------------------------------------------------------

/**
 * Get a display icon/symbol for a market trend.
 */
export function trendIcon(trend: string): string {
  switch (trend?.toUpperCase()) {
    case 'APPRECIATING':
    case 'STRONG_UP':
    case 'UP':
      return '\u2191'; // up arrow
    case 'STABLE':
      return '\u2192'; // right arrow
    case 'DECLINING':
    case 'STRONG_DOWN':
    case 'DOWN':
      return '\u2193'; // down arrow
    default:
      return '\u2022'; // bullet
  }
}

/**
 * Get a color for a market trend.
 */
export function trendColor(trend: string): string {
  switch (trend?.toUpperCase()) {
    case 'APPRECIATING':
    case 'STRONG_UP':
    case 'UP':
      return '#16A34A'; // green
    case 'STABLE':
      return '#D97706'; // amber
    case 'DECLINING':
    case 'STRONG_DOWN':
    case 'DOWN':
      return '#DC2626'; // red
    default:
      return '#6B6365'; // gray
  }
}
