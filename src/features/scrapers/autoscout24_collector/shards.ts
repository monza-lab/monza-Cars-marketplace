import type { SearchShard, AS24CountryCode } from "./types";

export const ALL_COUNTRIES: AS24CountryCode[] = ["D", "A", "B", "E", "F", "I", "L", "NL"];

export const COUNTRY_NAMES: Record<AS24CountryCode, string> = {
  D: "Germany",
  A: "Austria",
  B: "Belgium",
  E: "Spain",
  F: "France",
  I: "Italy",
  L: "Luxembourg",
  NL: "Netherlands",
};

/**
 * Porsche models used for AutoScout24 search path segmentation.
 * These map to the URL path: /lst/porsche/{model}
 */
const PORSCHE_MODELS = [
  "911", "718", "cayenne", "macan", "panamera", "taycan",
  "boxster", "cayman", "944", "928", "968", "356",
] as const;

/**
 * High-volume models that need per-country + year-range sharding
 * to stay under the 20-page (~400 listing) pagination limit.
 */
const HIGH_VOLUME_YEAR_SPLITS: Record<string, [number, number][]> = {
  "911": [
    [1963, 1989], // F-model + G-model + 930
    [1989, 1998], // 964 + 993
    [1998, 2005], // 996
    [2005, 2012], // 997
    [2012, 2016], // early 991
    [2016, 2019], // late 991
    [2019, 2022], // early 992
    [2023, 2026], // current 992
  ],
};

/**
 * Models that saturate the 20-page limit when searched without price filter.
 * Split into price-range sub-shards to capture full inventory.
 */
const PRICE_RANGE_SPLITS: Record<string, { from?: number; to?: number }[]> = {
  "718": [
    { to: 50000 },
    { from: 50001, to: 90000 },
    { from: 90001 },
  ],
  cayenne: [
    { to: 40000 },
    { from: 40001, to: 90000 },
    { from: 90001 },
  ],
  macan: [
    { to: 50000 },
    { from: 50001, to: 90000 },
    { from: 90001 },
  ],
  panamera: [
    { to: 50000 },
    { from: 50001, to: 120000 },
    { from: 120001 },
  ],
  taycan: [
    { to: 55000 },
    { from: 55001, to: 100000 },
    { from: 100001 },
  ],
  boxster: [
    { to: 40000 },
    { from: 40001, to: 80000 },
    { from: 80001 },
  ],
  cayman: [
    { to: 50000 },
    { from: 50001, to: 100000 },
    { from: 100001 },
  ],
};

const SECOND_LEVEL_YEAR_SPLITS: Record<string, [number, number][]> = {
  "718": [
    [2016, 2019],
    [2020, 2026],
  ],
  cayenne: [
    [2002, 2010],
    [2011, 2018],
    [2019, 2026],
  ],
  macan: [
    [2014, 2018],
    [2019, 2021],
    [2022, 2026],
  ],
  panamera: [
    [2009, 2016],
    [2017, 2020],
    [2021, 2026],
  ],
  taycan: [
    [2019, 2022],
    [2023, 2026],
  ],
};

/**
 * Generate search shards that partition the full AutoScout24 Porsche inventory.
 *
 * High-volume models (911) are split by year range × country.
 * Lower-volume models use a single shard with all countries.
 * A catch-all shard with no model filter catches unusual models.
 */
export function generateShards(options: {
  countries: AS24CountryCode[];
  models?: string[];
  maxPagesPerShard: number;
}): SearchShard[] {
  const shards: SearchShard[] = [];
  const models = options.models ?? [...PORSCHE_MODELS];

  for (const model of models) {
    const yearSplits = HIGH_VOLUME_YEAR_SPLITS[model];

    if (yearSplits) {
      // High-volume model: shard by year range PER country
      for (const country of options.countries) {
        for (const [yearFrom, yearTo] of yearSplits) {
          shards.push({
            id: `${model}-${country}-${yearFrom}-${yearTo}`,
            model,
            yearFrom,
            yearTo,
            countries: [country],
            maxPages: options.maxPagesPerShard,
          });
        }
      }
    } else if (PRICE_RANGE_SPLITS[model]) {
      // Saturated model: split by price range to stay under 20-page limit
      const priceSplits = PRICE_RANGE_SPLITS[model];
      const yearSplits = SECOND_LEVEL_YEAR_SPLITS[model];
      for (const [idx, range] of priceSplits.entries()) {
        const label = ["low", "mid", "high"][idx] ?? `p${idx}`;
        if (yearSplits) {
          for (const [yearFrom, yearTo] of yearSplits) {
            shards.push({
              id: `${model}-${label}-${yearFrom}-${yearTo}`,
              model,
              yearFrom,
              yearTo,
              priceFrom: range.from,
              priceTo: range.to,
              countries: options.countries,
              maxPages: options.maxPagesPerShard,
            });
          }
        } else {
          shards.push({
            id: `${model}-${label}`,
            model,
            priceFrom: range.from,
            priceTo: range.to,
            countries: options.countries,
            maxPages: options.maxPagesPerShard,
          });
        }
      }
    } else {
      // Lower-volume model: all countries together
      shards.push({
        id: `${model}-all`,
        model,
        countries: options.countries,
        maxPages: options.maxPagesPerShard,
      });
    }
  }

  // Catch-all: no model filter (catches unusual models like 914, Carrera GT, etc.)
  shards.push({
    id: "porsche-all-catchall",
    countries: options.countries,
    maxPages: options.maxPagesPerShard,
  });

  return shards;
}

/**
 * Split a saturated shard (hit 20-page limit) into price-range sub-shards.
 */
export function splitSaturatedShard(shard: SearchShard): SearchShard[] {
  const yearSplits = shard.model ? SECOND_LEVEL_YEAR_SPLITS[shard.model] : undefined;
  if (yearSplits) {
    return yearSplits.map(([yearFrom, yearTo]) => ({
      ...shard,
      id: `${shard.id}-${yearFrom}-${yearTo}`,
      yearFrom,
      yearTo,
    }));
  }

  const priceRanges: { from: number; to?: number }[] = [
    { from: 0, to: 50000 },
    { from: 50000, to: 100000 },
    { from: 100000, to: 200000 },
    { from: 200000 },
  ];

  return priceRanges.map((range, i) => ({
    ...shard,
    id: `${shard.id}-p${i}`,
    priceFrom: range.from,
    priceTo: range.to,
  }));
}
