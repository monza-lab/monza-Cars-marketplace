# Historical Market Evidence Design

## Goal

Use MonzaHaus's listings and price-history corpus in Haus Reports without
presenting asking prices as completed sales or repeated snapshots as independent
comparables.

## Evidence Contract

Every market observation belongs to one explicit layer:

1. `verified_sale`: a completed sale with a positive canonical sold or final
   price and a real sale date.
2. `asking_listing`: a positive active, delisted, or unsold listing price.
3. `price_history`: a timestamped price observation tied to one listing.
4. `broader_market`: series or family evidence used only when exact-variant
   evidence is insufficient.

One listing contributes at most one current asking comparable. Its repeated
price-history rows contribute to repricing and duration analysis, not to the
comparable count.

## Retrieval

The report pipeline queries evidence for the identified vehicle rather than
loading a Porsche-wide 500-row window and filtering afterward.

Candidate matching uses make, generation, year range, normalized model and
variant tokens. It accepts known taxonomy representations such as `997 GT3`,
`997`, `911 GT3`, and `911` when generation, year, title, and variant agree.
Contradictory variants such as `GT3 RS`, `Cup`, or another generation are
excluded.

Retrieval is bounded by evidence type:

- up to 100 recent exact-variant verified sales;
- up to 250 exact-variant asking listings;
- aggregated price-history statistics for all matched listing IDs;
- bounded broader-series evidence only when the exact layer is insufficient.

The pipeline persists total available counts even when only a representative
sample is included in report JSON.

## Longitudinal Signals

Price-history rows produce:

- observation count and distinct listing count;
- first and last capture timestamps;
- listings with at least one price change;
- median price-change percentage;
- median days observed;
- reductions versus increases;
- inventory and repricing direction.

Trend requires dated observations in both comparison periods. When the sample
cannot support a trend, the value is `null` and the direction is
`insufficient_data`; it is never converted into a zero-percent stable market.

## Valuation

The valuation baseline follows this order:

1. Median of at least three clean exact-variant verified sales.
2. Median of at least three exact-variant asking listings, labeled
   `asking_market`, with lower confidence.
3. Broader series or family valuation, labeled with its actual scope.
4. No numeric fair value when no layer has three usable observations.

Signals and vehicle-specific modifiers apply after the baseline is selected.
The report stores the baseline layer, sample count, capture range, and
confidence alongside the numeric range.

## Report And AI Behavior

The report discloses evidence in plain language, for example:

`15 verified sales · 176 asking listings · 2,058 price observations · Feb-Jul 2026`

Comparable tables label each row as `Sold` or `Asking`. Asking rows never appear
inside a sold-price distribution.

AI prompts receive the classified counts, date range, valuation layer,
confidence, and longitudinal signals. Prompts prohibit claims of sales,
stability, appreciation, or high confidence that are unsupported by the
classified evidence.

Resale projections remain model estimates and inherit the market-evidence
confidence. Insufficient trend evidence forces low projection confidence.

## Failure Handling

Failure to load one evidence layer does not discard the others. The market
bundle records unavailable layers and lowers confidence. It never silently
relabels another layer to replace the missing one.

Cached V3 reports remain readable. New fields are additive and optional during
the transition. Regenerated reports use the complete evidence contract.

## Validation

The implementation passes when:

- the broad query no longer returns a null-sale-date-only 500-row window;
- old active or unsold listings are never classified as verified sales;
- repeated price-history observations do not inflate comparable counts;
- exact-variant taxonomy aliases are included while contradictory variants are
  excluded;
- a report with sufficient verified sales uses their median;
- a report without sufficient sales uses and labels the asking-market anchor;
- insufficient trend data remains null rather than `0% stable`;
- the five stress-test reports persist evidence counts and capture ranges;
- live UI copy distinguishes sold, asking, history, and broader evidence;
- unit, integration, build, and live browser verification pass.
