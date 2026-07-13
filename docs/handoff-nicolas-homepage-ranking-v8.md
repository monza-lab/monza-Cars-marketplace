# Nicolas handoff: MonzaHaus landing-page ranking v8

## Product rule

The landing page is classic-prominent and special-car-first. Historically foundational classic
icons carry more collector priority than hypercars, while ordinary age alone does not make a car
an icon. Genuine modern special editions retain guaranteed visibility.

## Ordering contract

Server comparison is lexicographic:

1. historic classic icon, then hypercar, then remaining inventory;
2. intrinsic rarity score;
3. evidence quality;
4. usable photography;
5. modern live-market scarcity;
6. ending time and stable id.

The server emits `homepageRank`. Mobile, desktop, and sidebar clients preserve that rank. The
additive `homepageScore` remains diagnostic and must not be used to reconstruct the order.

## Landing-page portfolio

- Top 10: five classic positions, three modern-special positions, and two open positions.
- Top 50: at least twenty classics and ten modern specials; the remaining positions are open.
- The positions are paced rather than appended as era blocks.
- One canonical variant can occupy at most two Top-10 positions and five Top-50 positions.
- If a lane lacks eligible photographed inventory, selection falls back deterministically to the
  strongest open candidate without shortening the page.

Classics are canonical `356`, `f-model`, `g-model`, `930`, `964`, and `993` listings. A modern
special is a non-classic carrying `hypercar`, `homologation_special`, `gt_model`,
`limited_edition`, or `sonderwunsch`.

## Collector signals

- `historic_classic_icon`: 76 points. Narrow, historically specific classic archetypes.
- `hypercar`: 70 points. 959, Carrera GT, and 918.
- `homologation_special`: 36 points.
- `classic_significance`: 32 points. Classic lineage; not age-only icon status.
- Factory specification remains active: PTS, WLS, WTL, Sonderwunsch, Exclusive Manufaktur,
  sunroof delete, narrow-body Speedster, matching numbers, original paint, ownership, and mileage.

## Scarcity calculation

Scarcity is calculated only for recognized modern variants:

`round(15 x (1 - ln(active variant supply) / ln(max modern variant supply)))`

It is clamped to 0-15. One active example earns 15; the most supplied modern variant earns 0.
Duplicate VINs count once. Scarcity is compared only after collector importance, evidence, and
photography, so it cannot promote an ordinary scarce modern car over a stronger classic.

## Operations

- Ranking tests: `npx vitest run src/lib/listingRarity.test.ts src/lib/homepageRanking.test.ts src/lib/dashboardCache.test.ts src/components/dashboard/sidebar/useLiveSidebarListings.test.tsx`
- Regenerate comparison: `npx tsx scripts/compare-homepage-rarity-ranking.ts`
- Refresh active v8 rarity data: `npm run backfill:listing-rarity -- --status=active --batch-size=500`
- Render methodology PDF: `npx tsx scripts/render-rarity-methodology-pdf.ts`

The methodology source is `public/rarity-methodology.html`; the rendered handoff artifact is
`output/pdf/monzahaus-rarity-methodology.pdf`.
