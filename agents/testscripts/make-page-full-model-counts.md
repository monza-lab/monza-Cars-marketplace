# TS-MAKE-FULL-MODEL-COUNTS

## Objective
Ensure make pages show all model families and counts from full DB listings (not sampled active-only subsets).

## Prerequisites
- `.env.local` contains working Supabase credentials.
- App dependencies installed.

## Run
1. `npm run dev`
2. Open `/en/cars/porsche`
3. In Supabase SQL editor, run:
   `select model, count(*) from listings where lower(make)='porsche' group by model order by count(*) desc;`

## Expected
- Family/model blocks on the make page include families implied by the DB result set, including sold-only families.
- Family car counts align with DB-backed volume (after family grouping logic).
- Status filter `Ended` returns non-empty results when DB has sold/unsold/delisted rows.
- Existing live widgets still show active-only counts.

## Artifacts
- Screenshot: `agents/testscripts/artifacts/make-page-full-model-counts.png`
- Query output copy: `agents/testscripts/artifacts/make-page-full-model-counts.sql.txt`
