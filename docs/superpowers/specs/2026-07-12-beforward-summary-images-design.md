# BeForward Summary Images Design

## Problem

The BeForward collector's full-coverage profile intentionally uses summary-only discovery so it can process the complete catalog without thousands of WAF-sensitive detail requests. Each stock-list row already contains a usable BeForward CDN thumbnail, but `ListingSummary` discards it and `normalizeListingFromSummary` emits `photos: []`. A large discovery pass can therefore add more image-empty active listings than the bounded enrichment jobs can repair, which produced 58% image coverage after the 3,824-row crawl.

## Decision

Treat the stock-list thumbnail as valid initial image coverage. Parse the first source-owned image from each `tr.stocklist-row`, normalize protocol-relative URLs to HTTPS, carry it through `ListingSummary`, and persist it from summary-only normalization. Full detail enrichment remains responsible for replacing or expanding this single image into the complete gallery.

The writer receives the collector's `summaryOnly` run context. On insert or when the stored row has no photos, it writes the thumbnail. When an existing row already has photos, it omits image columns from the summary-only upsert so a one-image thumbnail cannot replace an enriched gallery.

## Boundaries

- Accept only `http://`, `https://`, or protocol-relative image URLs hosted by `image-cdn.beforward.jp`.
- Strip surrounding whitespace and normalize protocol-relative URLs to `https://`.
- Preserve current behavior when a source row genuinely has no valid BeForward image.
- Preserve every existing non-empty gallery during summary-only refreshes.
- Do not add detail requests, dependencies, or changes to the existing full-gallery enrichment jobs.

## Validation

- A discovery parser test uses representative stock-list HTML and proves the thumbnail enters `ListingSummary`.
- A summary normalization test proves the thumbnail becomes `photos[0]` and `photosCount === 1`.
- A writer test proves a summary-only thumbnail cannot overwrite an existing gallery.
- Existing BeForward collector, normalizer, writer, and scraper-runner tests remain green.
