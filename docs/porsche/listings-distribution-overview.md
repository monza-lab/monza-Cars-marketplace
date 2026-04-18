# Porsche Listings Distribution Overview

This note summarizes the current Supabase listing distribution so we can separate:

- a real market skew,
- from scraper coverage problems,
- from bad region normalization,
- and from valuation logic that is mixing incompatible data types.

## What I checked

- Total `listings` rows
- Price coverage by canonical market
- Source/platform distribution
- Raw `region` field quality
- Whether the corpus is large enough to support family-by-market valuation

## Database Size

Current counts from Supabase:

- Total listings: `53,015`
- Priced listings: `35,980`
- Sold listings: `4,597`
- Live listings: `18,072`

This is enough data to support a valuation model, but only if we use the right subset and the right market mapping.

## Canonical Market Distribution

Using source/platform mapping rather than the raw `region` column:

| Market | Listings | Share |
|---|---:|---:|
| EU | `26,575` | `50.1%` |
| US | `13,351` | `25.2%` |
| UK | `6,922` | `13.1%` |
| JP | `6,167` | `11.6%` |

### Interpretation

- The dataset is genuinely Europe-heavy.
- EU is about twice the size of the US.
- UK is meaningful but much smaller than EU.
- JP has inventory, but its pricing coverage is weak.

## Pricing Coverage By Market

| Market | Priced Rows | Pricing Coverage |
|---|---:|---:|
| EU | `24,914` | `93.7%` |
| US | `4,144` | `31.0%` |
| UK | `6,922` | `100%` |
| JP | `0` | `0%` |

### Interpretation

- EU is dominated by priced classifieds.
- US is much more auction/sold-history heavy.
- UK is almost entirely priced.
- JP is currently not usable for pricing-based valuation without a different ingest path.

## Source Mix

Top sources by listing count:

| Source | Total | Priced | Sold | Live |
|---|---:|---:|---:|---:|
| AutoScout24 | `22,413` | `22,413` | `0` | `6,639` |
| ClassicCom | `7,532` | `113` | `232` | `4,520` |
| AutoTrader | `6,922` | `6,922` | `0` | `1,280` |
| BeForward | `6,167` | `0` | `1` | `1,551` |
| BaT | `5,819` | `4,031` | `4,364` | `27` |
| Elferspot | `4,162` | `2,501` | `0` | `4,055` |

### Interpretation

The dataset is not one homogeneous data type.

- AutoScout24 and AutoTrader are mostly asking-price classifieds.
- BaT is mostly sold/priced auction history.
- ClassicCom and BeForward have lots of live inventory but weak or absent pricing.
- Elferspot is priced classifieds-heavy.

That means a valuation model must be explicit about whether it is using:

- asking prices,
- sold results,
- or a blend.

## Raw `region` Field Quality

The raw `region` column is not reliable enough to drive the dashboard directly.

Observed values include:

- `NULL` for `40,215` rows
- state names like `Florida`, `California`, `Texas`
- postal codes like `6700`, `57000`, `13090`
- malformed location fragments like `6666 MR`, `Stadt`

### Interpretation

- Raw `region` is noisy.
- Canonical market classification should come from source/platform mapping.
- The dashboard should not infer market distribution from the raw `region` field alone.

## Porsche Family Coverage

The current database is large enough for family-by-market valuation in the main buckets.

Representative sample sizes from Supabase:

| Family | EU Samples | US Samples |
|---|---:|---:|
| `992` | `2,815` | `33` |
| `991` | `1,514` | `41` |
| `997` | `1,176` | `72` |
| `996` | `644` | `54` |
| `993` | `303` | `23` |
| `964` | `292` | `26` |
| `930` | `119` | `82` |

### Interpretation

- The core Porsche generations are well-covered overall.
- EU has enough volume to produce stable medians.
- US is smaller but still usable for many families.
- Sparse buckets still need confidence labeling and should not be presented as equally certain.

## What This Means For Valuation

### Good

- There is enough data to switch valuation away from the live feed.
- Pricing-based medians are feasible for the core families.
- EU, US, and UK have enough inventory to produce meaningful comparisons.

### Risk

- Europe is structurally overrepresented because the source mix is classifieds-heavy.
- US valuation is more auction-driven and sold-history-driven.
- JP is currently too sparse on price data.
- Sparse markets can still look falsely precise if we hide sample count and confidence.

## Working Conclusion

The Europe skew is **real**, but it is not the whole story.

What is actually happening:

1. EU has the largest inventory volume.
2. The source mix is uneven across markets.
3. The raw region field is noisy enough to be misleading.
4. JP pricing coverage is effectively missing.
5. The valuation model should use canonical market buckets and show confidence.

## Next Questions

- Should valuation weight sold listings more heavily than active asking prices?
- Should ultra-rare variants be split out of the family median?
- Should JP be excluded until pricing coverage is fixed?
- Should the dashboard show market confidence and sample count by default?

