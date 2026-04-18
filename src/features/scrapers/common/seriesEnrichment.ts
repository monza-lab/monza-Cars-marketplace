import { extractSeries, getSeriesConfig } from "@/lib/brandConfig";

export type SeriesInput = {
  make: string;
  model: string | null | undefined;
  year: number | null | undefined;
  title?: string | null;
};

/**
 * Extracts and validates a series id for the given input.
 * Returns null when getSeriesConfig() rejects the extracted id (unknown/unclassified).
 */
export function computeSeries(input: SeriesInput): string | null {
  const { make, model, year, title } = input;
  const safeModel = model ?? "";
  const safeYear = year ?? 0;
  const safeTitle = title ?? undefined;

  const seriesId = extractSeries(safeModel, safeYear, make, safeTitle);

  // Reject if getSeriesConfig does not recognize this series id for the given make
  const config = getSeriesConfig(seriesId, make);
  if (!config) return null;

  return seriesId;
}

/**
 * Returns a new object with `series` added. Does not mutate the input.
 */
export function withSeries<T extends SeriesInput>(row: T): T & { series: string | null } {
  return { ...row, series: computeSeries(row) };
}
