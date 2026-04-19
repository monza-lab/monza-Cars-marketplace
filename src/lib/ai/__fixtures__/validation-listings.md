# Gemini Validation Listings (selected 2026-04-19)

These three listings are the regression targets for Gemini signal extraction prompt validation. See Task 28 for how they are used.

| # | Scenario | Listing ID | Year / Model | Description length |
|---|---|---|---|---|
| 1 | Rich (992 GT3-family, long description) | `38c0f512-1eeb-43b7-a73c-1f81af1534ca` | 2024 Porsche 911 GT3 RS | 28558 chars |
| 2 | Sparse (991 Carrera, short description) | `2cd90406-5857-47cb-b593-4a497bbddec7` | 2012 Porsche 991 Carrera | 37 chars |
| 3 | Challenging (997 GT3 RS) | `891effde-c23e-4bf8-86de-117631cdff7c` | 2007 Porsche 997 GT3 RS | 648 chars |

## How these were selected

Via `scripts/select-validation-listings.ts` run against production Supabase on 2026-04-19. Listings were filtered by make=Porsche, year range, and description length; candidates were sorted by description length and the top match for each scenario was chosen.

Notes on picks:
- The "rich" scenario originally targeted 992 GT3 (plain), but no 992 GT3 had a description >1500 chars in production. The top match is a 2024 911 GT3 RS with a 28.5k-char description — same 992 generation, same GT3 family, and it exercises the "rich content" case better than any plain GT3 available.
- The "sparse" 2012 991 Carrera has only 37 chars of description — exactly the edge case where Gemini must gracefully handle near-empty input.
- The "challenging" 2007 997 GT3 RS is a rare early-997.1 RS with a modest 648-char description, testing extraction on an uncommon variant with limited text.

## How they are used

Task 28 runs `buildSignalExtractionPrompt` against each listing's `description_text` via the real Gemini API (`gemini-2.5-flash`) and saves the output JSON as regression fixtures at `src/lib/ai/__fixtures__/gemini-signals-{rich|sparse|challenging}.json`. These fixtures lock down the current prompt behavior so future prompt changes can be diffed.

## Related files

- `scripts/select-validation-listings.ts` — the selection script
- `scripts/validate-gemini-extraction.ts` — Task 28's validation runner (TBD)
- `src/lib/ai/__fixtures__/gemini-signals-*.json` — Task 28 output fixtures (TBD)
