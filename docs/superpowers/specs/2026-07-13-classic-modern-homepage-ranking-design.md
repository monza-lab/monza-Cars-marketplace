# Classic-and-modern homepage ranking design

## Objective

Preserve the classic-Porsche prominence of the original homepage ranking while retaining the useful v7 specification signals and giving genuinely important modern special editions guaranteed visibility. Live-market scarcity may refine close decisions; it must never replace collector significance.

## Definitions

- **Classic:** a listing whose canonical Porsche series is `356`, `f-model`, `g-model`, `930`, `964`, or `993`, excluding replicas, tributes, recreations, conversions, backdates, homages, and equivalent lookalike wording.
- **Modern special:** a non-classic listing carrying at least one qualifying collector signal: `hypercar`, `homologation_special`, `gt_model`, `limited_edition`, or `sonderwunsch`. This includes cars such as the 918 Spyder, GT/RS models, modern Speedsters, Sport Classics, and similarly explicit factory specials. Scarcity alone never makes a car a modern special.
- **Open:** the strongest remaining listing of either era.

## Collector-first ordering

Candidate comparison is lexicographic rather than additive:

1. collector priority: historic classic icon, then hypercar, then the remaining inventory;
2. intrinsic v8 rarity score, descending;
3. evidence quality, descending;
4. usable photography;
5. live-market scarcity, descending;
6. ending time and stable id tie-breaks.

`historic_classic_icon` is deliberately narrow and carries 76 intrinsic points, above the
70-point `hypercar` signal. It identifies foundational archetypes such as the 356 Speedster,
air-cooled Carrera RS lineage, early 911 S, 930 3.0, narrow-body Speedster, and equivalent
factory icons. Ordinary classic age remains a separate, lower-weight lineage signal.

Scarcity therefore acts only after intrinsic significance. A 96-point modern car cannot outrank a 100-point classic because it happens to have fewer live listings. The existing 0-15 scarcity calculation remains available as context and as a close tie-breaker.

For a recognized modern variant, landing-page scarcity is:

`round(15 x (1 - ln(active variant supply) / ln(max modern variant supply)))`

The value is clamped to `0-15`; one active example receives 15 and the most-supplied
recognized modern variant receives 0. Duplicate VINs count once. Classics, ambiguous variants,
and missing supply data receive zero scarcity points.

## Homepage portfolio

The first ten positions use a paced `5 classic / 3 modern special / 2 open` portfolio. Required positions are distributed through the Top 10 so neither group is appended as a block. Open positions select the best remaining car and may increase either group’s final representation.

The first fifty positions guarantee at least:

- 20 classics;
- 10 modern specials;
- 20 open selections.

Required selections are paced throughout the Top 50. If a required lane lacks enough eligible, photographed listings, its unused positions fall back to the best remaining open candidates.

The existing canonical-variant diversity rule remains active: no more than two examples of one variant in the first ten and no more than five afterward.

## Data flow

1. Recompute intrinsic v8 signals and canonical variant identity.
2. Attach evidence, photography, and deduplicated live-supply context.
3. Classify every candidate as classic, modern special, and/or open.
4. Sort each candidate lane with the collector-first comparator.
5. Select the paced portfolio while enforcing variant caps and deduplication.
6. Attach an explicit `homepageRank` so mobile and desktop clients preserve the server portfolio after filtering.
7. Keep `homepageScore` and its components as diagnostics; clients must not reconstruct ordering from the additive score.

## Failure behavior

- Missing variant-count data produces zero scarcity and does not block ranking.
- Unknown or ambiguous variants remain eligible for open positions but do not satisfy classic or modern-special guarantees.
- Replicas, tributes, recreations, conversions, and homages remain eligible for open positions but never satisfy a classic or modern-special guarantee.
- Missing photography defers a listing behind equally significant photographed cars and prevents it from satisfying a required lane while a photographed eligible alternative exists.
- Insufficient lane supply falls back deterministically to open candidates without returning fewer homepage cars.

## Validation

- A regression test proves a 100-point classic remains ahead of a 96-point scarce modern listing.
- Top-10 tests prove at least five classics, at least three modern specials, and no more than two examples per variant.
- Top-50 tests prove at least twenty classics, at least ten modern specials, and no more than five examples per variant.
- Client tests prove `homepageRank` survives filtering and remains the primary order.
- The frozen live-data comparison is regenerated and manually inspected before release.
- Focused tests and the production build must pass before pushing `main` and redeploying.

## Release and handoff

After verification, commit and push the implementation to `main`, trigger a production redeployment, and create a concise Nicolas-facing handoff under `docs/` explaining the collector-first comparator, portfolio guarantees, qualifying signals, fallback behavior, deployment requirements, and how to regenerate the Top-50 report.
