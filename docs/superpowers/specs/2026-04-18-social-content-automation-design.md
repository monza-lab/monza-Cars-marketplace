# MonzaHaus Social Engine — Design Spec

**Date**: 2026-04-18
**Author**: Edgar (@edgar@monzalab.com) + Claude
**Status**: v1 **implemented and archived**. Current operating mode is **v0.5 (local semi-auto batch)** — see the "Operating Modes" section below.

**Visual reference**: [`assets/2026-04-18-social-carousel-mockup.html`](./assets/2026-04-18-social-carousel-mockup.html) — static HTML mockup of the 5-slide carousel rendered with real DB data (2004 Porsche 911 GT3 from BaT). Opens in any browser. Used as the visual truth for template implementation.

## Operating Modes

### v0.5 — Local semi-auto batch (current)
A daily CLI script generates 10 carousels + captions to a local folder. Edgar uploads manually to Meta Business. No Meta API, no dashboard, no cron, no Storage bucket needed. Fast to operate, zero external setup beyond the Supabase migration. Output lives in `producto/posts/YYYY-MM-DD/`.

### v1 — Fully automated (archived, re-enable later)
All code below (worker cron, admin dashboard with approval, Meta Graph API publisher, Supabase Storage) is implemented and committed but **inactive** until Edgar chooses to promote. Re-enabling requires: Meta App setup + long-lived token, Supabase Storage bucket + policies, `ADMIN_DASHBOARD_TOKEN` env var. See `docs/social-engine-setup.md`. The Vercel Cron entry for `/api/cron/social-engine` in `vercel.json` can stay disabled (comment it out) until then.

**The rest of this document describes v1.** It is preserved intact for reference and future re-activation.

---

---

## Goal

Publish consistently high-quality collector-car carousels on Instagram and Facebook from the existing MonzaHaus listings database, with human approval kept to a single click. Each post must anchor to a specific `listing_report` inside the MonzaHaus platform so social content drives traffic to real market intelligence, not to likes.

The north star: quality over volume. A feed that feels like a private salon, not a commodity auto page.

## Non-goals (v1)

- Reels, stories, or any non-carousel format. Edgar handles those manually.
- Market-pulse or evergreen carousels (single-listing deep-dives only in v1).
- Multi-language content (English only).
- Full admin/roles system. A single env-var gate is enough for v1.
- Classic.com listings as a source (resolution too low at 600×338).
- Rotating `/latest` landing page on the web. Bio is managed manually.
- Sentry / external observability. Vercel logs only.

## Success criteria

- End-to-end: scraped listing → filtered draft → generated carousel → published to IG+FB with one click, without Edgar touching the creative layer.
- Zero low-quality posts (blurry photos, bad framing, generic copy) reach publish. Quality gates catch them before the dashboard.
- Up to 5 **new drafts per day** (worker batch cap). Published posts per day depend on Edgar approving; unapproved drafts carry forward.

---

## Content unit

**Single-listing deep-dive carousel.** 5 slides at 1080×1350 (Instagram 4:5), following the official MonzaHaus Salon carousel pattern (Cover dark → Data dark → Accent rosa → Light → CTA dark).

| # | Slide | Theme | Photo source | Data source |
|---|-------|-------|--------------|-------------|
| 1 | **Cover** | dark | `listing.images[0]` (full bleed) | title, platform, location |
| 2 | **Specs** | dark | `listing.images[1]` (60/40 split) | year, engine, transmission, mileage, exterior color, price, reserve status |
| 3 | **Market position** | rosa (attention anchor) | none | `ComparableSales` component output: avg, range, delta vs this listing |
| 4 | **Story** | light | `listing.images[2]` (detail: interior/engine) | `hagerty_grade`, `matching_numbers`, `original_vs_restored`, `ownership_count`, `service_records_complete`, plus `brandConfig.getSeriesThesis()` |
| 5 | **CTA** | dark | `listing.images[3]` (overlay dark) | "Visítanos · monzahaus.com" + "M" logo |

Caption: 3-4 lines ending with `Full report at monzahaus.com/cars/{make}/{listing-id}/report` (not clickable on IG, clickable on FB). The slug is derived from the existing app route pattern `/cars/[make]/[id]/report` — no new slug field is needed. Max 2-3 curated hashtags in a comment below the post.

---

## Architecture

One Next.js app (`/producto`), four logical components:

```
┌──────────────────────────────────────────────────────────────────────┐
│  /producto (Next.js 16, Vercel Pro)                                  │
│                                                                       │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐       │
│  │ 1. WORKER      │   │ 2. GENERATOR   │   │ 3. DASHBOARD   │       │
│  │ cron /6h       │──▶│ on-demand      │──▶│ admin UI       │       │
│  │ Gates 1+2      │   │ HTML→PNG       │   │ review/edit    │       │
│  └────────────────┘   └────────────────┘   └───────┬────────┘       │
│         │                    │                     │                 │
│         ▼                    ▼                     ▼                 │
│  ┌────────────────────────────────────────┐  ┌────────────┐         │
│  │ Table: social_post_drafts              │  │ 4. PUBLISHER│        │
│  │ - status lifecycle                     │◀─│ Meta Graph  │        │
│  │ - scores, images, caption, post IDs    │  │ API         │        │
│  └────────────────────────────────────────┘  └────────────┘         │
└──────────────────────────────────────────────────────────────────────┘
```

Code lives at `src/features/social-engine/` following the convention of `src/features/scrapers/`.

### Why this shape

- **Single repo, single deploy** — no service split. Same DB client, same auth context, same build pipeline. A split would be premature.
- **On-demand generation** — Puppeteer is slow (~15s per carousel). Generating inside the worker would saturate the cron and render for drafts that may never be reviewed. Lazy generation pays cost only on open.
- **Upsert on `listing_id`** — the worker can re-run safely. No duplicate drafts for the same listing.
- **Publisher decoupled from generator** — caption edits or image regeneration can happen independently of publishing.

---

## Data model

### New table: `social_post_drafts`

```sql
create table social_post_drafts (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id),
  status text not null default 'pending_review',
    -- pending_review | generating | ready | approved
    -- | publishing | published | discarded | failed
  quality_score int,              -- 0-100 from Gate 1 heuristic
  vision_score int,               -- 0-100 from Gate 2 (Gemini)
  vision_notes text,              -- AI-provided reasons for score
  selected_photo_indices int[],   -- which listing photos were chosen
  generated_slide_urls text[],    -- 5 PNG URLs in Supabase Storage
  caption_draft text,
  caption_final text,             -- edited by Edgar pre-publish
  hashtags text[],
  fb_post_id text,
  ig_post_id text,
  ig_creation_id text,            -- IG container ID for debugging
  published_at timestamptz,
  reviewed_at timestamptz,
  discarded_reason text,
  error_log jsonb,                -- accumulates failure details
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(listing_id)
);

create index idx_social_drafts_status on social_post_drafts(status);
create index idx_social_drafts_created on social_post_drafts(created_at desc);
```

No existing schema is modified. Reads draw from existing tables (`listings`, `vehicle_specs`, `price_history`, `photos_media`, `listing_reports`) and code (`brandConfig.ts`).

### Storage bucket: `social-carousels`

Supabase Storage bucket, public-read, service-role-write. Layout:
```
social-carousels/
  {draftId}/
    slide-1.png
    slide-2.png
    slide-3.png
    slide-4.png
    slide-5.png
```

---

## Component 1 — Worker

**Entry point**: `producto/scripts/social-engine-worker.ts` (matches `ingest-porsche.ts` pattern).
**Trigger**: Vercel Cron **once per day at 09:00 UTC** hitting `/api/cron/social-engine`, which invokes the worker.
**Batch cap**: 5 new drafts per run. Since cron runs once per day, this enforces the "up to 5 drafts/day" rule directly. Overflow listings are not lost — they remain unprocessed in `listings` and become candidates in subsequent runs.

### Gate 1 — cheap filters (SQL + HEAD check)

Source allowlist with quality thresholds:

```sql
select l.*
from listings l
where l.status = 'active'
  and l.platform in ('ELFERSPOT', 'BRING_A_TRAILER', 'AUTO_SCOUT_24')
  and l.photos_count >= 10
  and l.data_quality_score >= 70
  and l.created_at >= now() - interval '7 days'
  and not exists (
    select 1 from social_post_drafts d where d.listing_id = l.id
  )
  and (
    -- thesis match: Porsche collector series (series allowlist below)
    (
      l.make = 'Porsche'
      and extract_series_fn(l.model, l.year) = any (array[
        '964','993','997','991','992','930','718-cayman','carrera-gt'
      ])
    )
    or l.trim ~* 'gt3|gt2|rs|turbo s|speedster'
  )
order by l.data_quality_score desc, l.photos_count desc
limit 20;
```

Per candidate: `HEAD` request on `images[0]`. If `content-length` is below a minimum threshold or `content-type` is not `image/*`, drop. Optional: parse first few bytes to confirm dimensions ≥ 1080px on the long edge.

Series allowlist is sourced from `brandConfig.ts` (`getFamilyGroupsWithSeries('porsche')`) plus an explicit include list in `src/features/social-engine/config.ts`. The SQL pseudocode above uses an inline constant list for clarity; real implementation resolves the series list at worker startup from brandConfig. Series extraction reuses `extractSeries(model, year, make)` from `brandConfig.ts` (must be exposed as a Postgres function or pre-computed in JS before the query — preferred: pre-compute, query by `model` + `year` patterns).

### Gate 2 — Gemini Vision

Top 3 candidates after Gate 1. For each, send the first 3 photos to **Gemini 2.0 Flash** (`@google/generative-ai` — already installed). Prompt:

```
You are evaluating photos of a collector vehicle for editorial social-media use.
Score each set of photos on a 0-100 scale based on:
(a) framing and composition
(b) lighting quality
(c) setting/background (studio or premium location vs. cluttered parking lot)
(d) vehicle completeness (full body shots, variety of angles)
(e) absence of distracting watermarks, people, or visual noise

Return JSON:
{
  "score": <int 0-100>,
  "reasons": [<short strings>],
  "best_photo_index": <0..n>,
  "recommended_indices": [<up to 4 photo indices in order of preference>]
}
```

Threshold: `vision_score >= 75`. Passers insert into `social_post_drafts` with:
- `status = 'pending_review'`
- `quality_score` = Gate 1 heuristic score
- `vision_score`, `vision_notes`, `selected_photo_indices` from Gemini

### Scheduling

`vercel.json` cron entry:
```json
{
  "crons": [
    { "path": "/api/cron/social-engine", "schedule": "0 9 * * *" }
  ]
}
```

### Error handling

- Per-candidate failures (HEAD check, Gemini API error) are logged to `error_log` on the draft if already created, otherwise to Vercel logs with listing_id. Worker continues to next candidate.
- Worker failure mid-batch is acceptable — next run picks up where it left off because uprocessed listings stay in `listings` without a draft row.

---

## Component 2 — Generator

**Route**: `app/api/social/generate/[draftId]/route.ts` (POST).
**Trigger**: called by the dashboard the first time a draft is opened (or by user clicking "Regenerate").
**Runtime**: Node runtime (not Edge — requires Puppeteer and chromium binary).

### Render pipeline

1. Fetch draft + listing + `vehicle_specs` + `price_history` comparables + `brandConfig.getSeriesThesis()`.
2. Update `status = 'generating'`.
3. Launch Puppeteer via `@sparticuz/chromium` (already in deps).
4. For each slide index 1..5:
   - `page.goto('/internal/carousel/[draftId]/[slideIdx]')` (internal Next.js route, no public exposure)
   - `page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 })`
   - `page.screenshot({ type: 'png' })` → buffer
   - Upload to Supabase Storage: `social-carousels/{draftId}/slide-{n}.png`
5. Store 5 public URLs in `generated_slide_urls`.
6. Update `status = 'ready'`.

If any step fails: `status = 'failed'`, append to `error_log`. Dashboard shows a "Regenerate" button.

### Slide templates

Location: `src/features/social-engine/templates/CarouselV1/`
- `Slide1Cover.tsx`, `Slide2Specs.tsx`, `Slide3Market.tsx`, `Slide4Story.tsx`, `Slide5CTA.tsx`
- Shared layout wrapper: `SlideFrame.tsx` (1080×1350, applies brand tokens, loads Cormorant + Karla from Google Fonts with `display=block` so Puppeteer waits).
- Brand tokens source: `branding/tokens.css` lives at workspace root (outside `/producto`). For the Next.js app to use it, copy it once into `producto/src/features/social-engine/styles/brand-tokens.css` as a build-time or checked-in copy. Do not symlink (Vercel build issues). Updates to branding get manually synced; acceptable for v1 given branding churn is low.

Each template is a pure React server component that reads from props only. The `/internal/carousel/[draftId]/[slideIdx]` route loads data server-side and renders the chosen template.

### Copy generation (Claude)

Within the generator route, before screenshotting, call Claude once via `@anthropic-ai/sdk` (model: Sonnet 4.6).

Inputs:
- Listing row (title, year, make, model, trim, location, platform, price, seller_notes)
- `vehicle_specs` (engine, transmission, mileage, colors)
- Comparables output (avg, range, sample size)
- `brandConfig.getSeriesThesis()` for the series
- MonzaHaus brand voice excerpt (static, loaded from `branding/brand-voice.md`)

Output shape:
```json
{
  "caption": "<3-4 lines, ending with 'Full report at monzahaus.com/cars/<make>/<id>/report'>",
  "hashtags": ["<1-3 curated hashtags>"]
}
```

Persist to `caption_draft` and `hashtags`. Edgar can edit `caption_final` in the dashboard.

### Cost and performance

Per carousel (rough budget):
- Gemini Vision Gate 2: <$0.01 per listing evaluated
- Claude caption: <$0.02 per draft generated
- Puppeteer: ~15s wall clock, negligible cost on Vercel Pro
- Supabase Storage: 5 PNGs ~2MB total per draft

---

## Component 3 — Dashboard

**Route**: `app/[locale]/admin/social/page.tsx` (locale fixed to `en` in practice).

### Gate

Lightweight middleware `app/[locale]/admin/social/middleware.ts`:
- Reads header `x-admin-token`.
- Compares against `process.env.ADMIN_DASHBOARD_TOKEN` (constant-time compare).
- On mismatch or missing: return 401.

For v1 this is the only gate. Token is set once in Vercel env. Follow-up: migrate to Supabase Auth with role claim.

### UI

**Index view** (`/admin/social`):
- List of drafts, ordered by `created_at desc`.
- Tabs: `Pending review` (default), `Published`, `Discarded`, `Failed`.
- Card per draft: cover photo thumbnail, `{year} {model} {trim}`, `quality_score · vision_score`, platform badge, "Open" button.

**Detail view** (`/admin/social/[draftId]`):
- Top: listing link-back to `/cars/[make]/[id]/report`.
- Carousel preview: all 5 generated PNGs rendered at 50% size, horizontal scroll, identical to how IG will show them.
- Caption editor: `<textarea>` bound to `caption_final` (defaults to `caption_draft`). Character count visible.
- Hashtag chips, editable.
- Actions (buttons): `Publish`, `Regenerate copy`, `Regenerate images`, `Discard`.
- Metadata sidebar: scores, filter reasoning, link to source listing.

**Published view**: read-only table with IG/FB post links.

---

## Component 4 — Publisher

**Route**: `app/api/social/publish/[draftId]/route.ts` (POST).
**Runtime**: Node runtime.

### Flow (Meta Graph API v19.0+)

```
1. Validate draft.status == 'approved' (or 'ready' with explicit approval flag)
2. Set status = 'publishing'
3. Instagram (Content Publishing API):
   a. For each slide URL, POST /{ig-user-id}/media with is_carousel_item=true
      → returns a container ID
   b. POST /{ig-user-id}/media with media_type=CAROUSEL, children=[ids]
      → returns carousel container ID (save as ig_creation_id)
   c. POST /{ig-user-id}/media_publish with creation_id
      → returns ig_post_id
4. Facebook Page (in parallel):
   a. POST /{page-id}/photos for each slide (published=false) → get ids
   b. POST /{page-id}/feed with attached_media=[ids], message=caption_final
      → returns fb_post_id
5. On full success: status = 'published', published_at = now()
6. On any failure: status = 'failed', append to error_log, keep draft visible with Retry button
```

### Meta API prerequisites (manual, one-time)

Documented separately in `docs/social-engine-setup.md` (to be written in implementation):
- Facebook Page creation
- Instagram Business Account linked to that Page
- Meta App with permissions: `pages_read_engagement`, `pages_manage_posts`, `instagram_content_publish`, `instagram_basic`
- Long-lived Page Access Token (60 days; manual refresh initially)
- Env vars: `META_PAGE_ACCESS_TOKEN`, `META_PAGE_ID`, `META_IG_BUSINESS_ID`, `META_GRAPH_API_VERSION`

### Rate limits

Meta's IG Content Publishing API: 25 API-published posts per 24h per IG account. Our cap of 5 posts/day is well under. No throttling logic required in v1.

---

## Error handling and observability

- **Worker**: per-candidate failures logged, batch continues. Batch failure logs to Vercel, next run retries naturally.
- **Generator**: slide-level failures leave draft in `failed` status with `error_log`. `Regenerate` button in dashboard.
- **Publisher**: any Meta API error → `failed` status. Retry button issues a new publish call, which re-uses existing creation IDs where possible.
- **Token expiry**: Meta long-lived tokens last ~60 days. A follow-up task will handle automated refresh; v1 sends a Vercel log warning 7 days before expiry.
- **Logs**: structured `console.log` with `{component, draftId, listingId, event, ...}`. Viewable in Vercel.

## Testing

- **Unit (Vitest)**: Gate 1 query builder, Gate 2 response parser, caption prompt builder, Meta payload builder.
- **Integration**: fixture-driven end-to-end on a real past Porsche 964 RS listing from BAT. Generates slides to a temp bucket; does NOT call Meta (uses a mock client).
- **Visual regression**: snapshot the 5 rendered slide HTML pages (not the PNG, which is non-deterministic across chromium versions).
- **Live dry-run**: optional "Preview in IG test account" env toggle before go-live.

---

## Implementation phases (order of work)

1. **Schema + types** — migration for `social_post_drafts`, TypeScript types, Storage bucket setup.
2. **Worker skeleton** — script + cron route + Gate 1 SQL. Runs and logs candidates without creating drafts.
3. **Gate 2 (vision)** — Gemini integration, promote worker to insert drafts.
4. **Templates** — 5 slide React components + shared frame, rendered via a preview route (no Puppeteer yet).
5. **Generator** — Puppeteer + Supabase Storage upload + Claude caption.
6. **Dashboard** — list, detail, caption editor, middleware gate.
7. **Publisher** — Meta Graph API calls, IG + FB parallel, status lifecycle.
8. **End-to-end test + docs** — integration test + Meta setup doc.

## Open questions for future iterations

- Automated Meta token refresh (60-day cycle).
- Classic.com re-enable — requires finding a full-res CDN param.
- Reels generation (manual today).
- Market-pulse carousels (segment-level, weekly).
- "Learn from discarded drafts" feedback loop into Gate 2 (train threshold).
- Bilingual posts (ES account separate).

---

*End of spec.*
