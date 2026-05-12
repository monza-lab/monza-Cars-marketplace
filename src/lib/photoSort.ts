type ListingWithPhotos = {
  images?: readonly string[] | null;
  image?: string | null;
};

// Matches our own placeholder asset and common CDN "no image" naming used by
// scraped marketplaces. Backend will eventually stop emitting these, but until
// then we deprioritize listings whose only image is one of these tokens.
const PLACEHOLDER_PATTERN = /(placeholder|no[_\-]?image|no[_\-]?photo|unavailable|image[_\-]?not[_\-]?found)/i;

/** True when the listing has a real photo (not a placeholder, not empty). */
export function hasPhoto(car: ListingWithPhotos): boolean {
  const url = car.images?.[0] ?? car.image ?? "";
  if (!url) return false;
  return !PLACEHOLDER_PATTERN.test(url);
}

/**
 * Compose a sort that puts cars-with-photos first, then defers to `secondary`.
 * Use as: `auctions.sort(byPhotoFirst((a, b) => a.endTime - b.endTime))`
 */
export function byPhotoFirst<T extends ListingWithPhotos>(
  secondary?: (a: T, b: T) => number,
): (a: T, b: T) => number {
  return (a, b) => {
    const diff = Number(hasPhoto(b)) - Number(hasPhoto(a));
    if (diff !== 0) return diff;
    return secondary ? secondary(a, b) : 0;
  };
}

/** Partition into [withPhoto, withoutPhoto] preserving relative order. Useful for paginated streams. */
export function partitionByPhoto<T extends ListingWithPhotos>(
  items: readonly T[],
): { withPhoto: T[]; withoutPhoto: T[] } {
  const withPhoto: T[] = [];
  const withoutPhoto: T[] = [];
  for (const item of items) {
    (hasPhoto(item) ? withPhoto : withoutPhoto).push(item);
  }
  return { withPhoto, withoutPhoto };
}
