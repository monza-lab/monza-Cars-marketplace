# MonzaHaus Social Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate IG + FB carousel publication from new MonzaHaus listings with 3-gate quality filtering (SQL + AI vision + 1-click human review), producing branded 5-slide carousels anchored to listing reports on the platform.

**Architecture:** Worker (daily cron) selects listings via Gate 1 (SQL filters) → Gate 2 (Gemini vision) → inserts drafts in `social_post_drafts`. Admin dashboard shows drafts, triggers on-demand carousel generation (Puppeteer screenshots 5 React slide templates → Supabase Storage). Single click publishes to IG + FB via Meta Graph API. Claude generates caption; Gemini scores photo quality.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (Postgres + Storage), `@anthropic-ai/sdk`, `@google/generative-ai`, `playwright-core` + `@sparticuz/chromium`, Meta Graph API v19.0, Vitest, Vercel Cron.

**Spec:** [`docs/superpowers/specs/2026-04-18-social-content-automation-design.md`](../specs/2026-04-18-social-content-automation-design.md)
**Visual reference:** [`docs/superpowers/specs/assets/2026-04-18-social-carousel-mockup.html`](../specs/assets/2026-04-18-social-carousel-mockup.html)

---

## File Structure

**New directory**: `producto/src/features/social-engine/`

```
src/features/social-engine/
├── config.ts                     # Series allowlist, thresholds, source ranking
├── types.ts                      # SocialPostDraft, VisionScore, CaptionOutput
├── styles/
│   └── brand-tokens.css          # Copied from /branding/tokens.css
├── repository/
│   └── draftRepository.ts        # CRUD for social_post_drafts
├── services/
│   ├── photoValidator.ts         # URL filter + HEAD check
│   ├── photoValidator.test.ts
│   ├── listingSelector.ts        # Gate 1 SQL + brandConfig series match
│   ├── listingSelector.test.ts
│   ├── visionScorer.ts           # Gate 2 Gemini vision
│   ├── visionScorer.test.ts
│   ├── comparablesService.ts     # Fetch comps for slide 3 market position
│   ├── captionGenerator.ts       # Claude caption + hashtags
│   ├── captionGenerator.test.ts
│   ├── carouselRenderer.ts       # Puppeteer 5-slide PNG render
│   ├── storageUploader.ts        # Supabase Storage uploads
│   ├── metaPublisher.ts          # IG + FB Graph API
│   └── metaPublisher.test.ts
├── workers/
│   └── worker.ts                 # Orchestrator for Gate 1 + Gate 2 + draft insert
└── templates/
    └── CarouselV1/
        ├── SlideFrame.tsx        # Shared wrapper: fonts, tokens, 1080x1350
        ├── Slide1Cover.tsx
        ├── Slide2Specs.tsx
        ├── Slide3Market.tsx
        ├── Slide4Story.tsx
        ├── Slide5CTA.tsx
        └── templateData.ts       # Type for slide props
```

**New app routes**:

```
src/app/
├── api/
│   ├── cron/social-engine/route.ts         # Vercel Cron entry
│   ├── social/generate/[draftId]/route.ts  # On-demand carousel generation
│   └── social/publish/[draftId]/route.ts   # Meta publish trigger
├── internal/
│   └── carousel/[draftId]/[slideIdx]/page.tsx   # Slide page rendered by Puppeteer
└── [locale]/
    └── admin/
        └── social/
            ├── middleware.ts               # Admin token gate
            ├── page.tsx                    # Drafts list
            └── [draftId]/page.tsx          # Draft detail
```

**Modifications**:
- `producto/supabase/migrations/20260418_create_social_post_drafts.sql` — new migration
- `producto/vercel.json` — append cron entry
- `producto/scripts/social-engine-worker.ts` — CLI entry mirror (matches `ingest-porsche.ts` pattern)

---

## Preconditions (manual setup, one-time)

These cannot be automated; document and request Edgar runs them before Task 15:

1. **Supabase Storage bucket**: create public bucket `social-carousels` via Supabase dashboard (Storage → New bucket → Public read, service-role write).
2. **Meta setup** (see Task 16 for detailed doc):
   - Facebook Page created under Edgar's Meta Business Manager
   - Instagram Business Account connected to that Page
   - Meta Developer app with permissions `pages_read_engagement`, `pages_manage_posts`, `instagram_content_publish`, `instagram_basic`
   - Long-lived Page Access Token issued
3. **Env vars** added to Vercel (and `.env.local` for dev):
   - `META_PAGE_ACCESS_TOKEN`
   - `META_PAGE_ID`
   - `META_IG_BUSINESS_ID`
   - `META_GRAPH_API_VERSION=v19.0`
   - `ADMIN_DASHBOARD_TOKEN` (any secure random string, e.g. `openssl rand -hex 32`)
   - `CRON_SECRET` (optional but recommended; Vercel can auto-provide one)

---

## Task 1: Database migration + types

**Files:**
- Create: `producto/supabase/migrations/20260418_create_social_post_drafts.sql`
- Create: `producto/src/features/social-engine/types.ts`
- Create: `producto/src/features/social-engine/config.ts`

- [ ] **Step 1: Write the migration**

Create `producto/supabase/migrations/20260418_create_social_post_drafts.sql`:

```sql
-- Migration: Create social_post_drafts for the MonzaHaus Social Engine
-- One draft per listing; tracks quality scores, generated images, caption, publish IDs.

create table if not exists social_post_drafts (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  status text not null default 'pending_review',
    -- pending_review | generating | ready | approved | publishing | published | discarded | failed
  quality_score int,
  vision_score int,
  vision_notes text,
  selected_photo_indices int[],
  generated_slide_urls text[],
  caption_draft text,
  caption_final text,
  hashtags text[],
  fb_post_id text,
  ig_post_id text,
  ig_creation_id text,
  published_at timestamptz,
  reviewed_at timestamptz,
  discarded_reason text,
  error_log jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (listing_id)
);

create index if not exists idx_social_drafts_status on social_post_drafts(status);
create index if not exists idx_social_drafts_created on social_post_drafts(created_at desc);

-- Trigger to auto-update updated_at on row change
create or replace function set_social_drafts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_social_drafts_updated_at on social_post_drafts;
create trigger trg_social_drafts_updated_at
before update on social_post_drafts
for each row execute function set_social_drafts_updated_at();
```

- [ ] **Step 2: Apply the migration to Supabase**

Run via Supabase dashboard SQL editor (paste contents) or via psql connection. The project uses Supabase migrations as reference files but applies manually (see other migrations in `supabase/migrations/`).

Verify:
```sql
select column_name, data_type from information_schema.columns where table_name = 'social_post_drafts';
```
Expected: all 20 columns listed above.

- [ ] **Step 3: Create type file**

Create `producto/src/features/social-engine/types.ts`:

```typescript
export type DraftStatus =
  | "pending_review"
  | "generating"
  | "ready"
  | "approved"
  | "publishing"
  | "published"
  | "discarded"
  | "failed";

export interface SocialPostDraft {
  id: string;
  listing_id: string;
  status: DraftStatus;
  quality_score: number | null;
  vision_score: number | null;
  vision_notes: string | null;
  selected_photo_indices: number[] | null;
  generated_slide_urls: string[] | null;
  caption_draft: string | null;
  caption_final: string | null;
  hashtags: string[] | null;
  fb_post_id: string | null;
  ig_post_id: string | null;
  ig_creation_id: string | null;
  published_at: string | null;
  reviewed_at: string | null;
  discarded_reason: string | null;
  error_log: ErrorLogEntry[];
  created_at: string;
  updated_at: string;
}

export interface ErrorLogEntry {
  at: string;
  component: "worker" | "generator" | "publisher";
  message: string;
  details?: unknown;
}

export interface VisionScore {
  score: number;
  reasons: string[];
  best_photo_index: number;
  recommended_indices: number[];
}

export interface CaptionOutput {
  caption: string;
  hashtags: string[];
}

export interface ListingRow {
  id: string;
  title: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  platform: string | null;
  photos_count: number | null;
  data_quality_score: number | null;
  images: string[] | null;
  final_price: number | null;
  current_bid: number | null;
  engine: string | null;
  transmission: string | null;
  mileage: number | null;
  color_exterior: string | null;
  color_interior: string | null;
  location: string | null;
  reserve_status: string | null;
  seller_notes: string | null;
  status: string | null;
  created_at: string;
}

export interface ComparablesSummary {
  avg: number;
  low: number;
  high: number;
  sampleSize: number;
  windowMonths: number;
  thisPrice: number | null;
  deltaPct: number | null;
}
```

- [ ] **Step 4: Create config file**

Create `producto/src/features/social-engine/config.ts`:

```typescript
import type { SeriesConfig } from "@/lib/brandConfig";

// Source allowlist (ordered by quality — Elferspot best, AS24 baseline)
export const ALLOWED_PLATFORMS = [
  "ELFERSPOT",
  "BRING_A_TRAILER",
  "AUTO_SCOUT_24",
] as const;
export type AllowedPlatform = (typeof ALLOWED_PLATFORMS)[number];

// Gate 1 thresholds
export const GATE_1 = {
  minPhotosCount: 10,
  minDataQualityScore: 70,
  lookbackDays: 7,
  minImageBytes: 40_000, // below this, image is too small/compressed
};

// Gate 2 threshold
export const GATE_2 = {
  visionThreshold: 75,
  gateModel: "gemini-2.0-flash", // stable; falls back with try/catch if not available
  photoSampleSize: 3,
  maxPhotosToRecommend: 4,
};

// Worker batch config
export const WORKER = {
  maxDraftsPerRun: 5,
  maxCandidatesFromGate1: 20,
};

// Collector-grade Porsche series allowlist (subset of brandConfig)
// Used as an explicit positive list beyond brandConfig to avoid Cayenne/Taycan/etc.
export const COLLECTOR_SERIES_IDS = [
  "964",
  "993",
  "997",
  "991",
  "992",
  "930",
  "964-rs",
  "993-rs",
  "718-cayman-gt4",
  "carrera-gt",
] as const;

// Trim regex for GT/RS/Turbo-S/Speedster — captures variants without needing exact series match
export const COLLECTOR_TRIM_REGEX = /gt3|gt2|\brs\b|turbo s|speedster|carrera gt|singer/i;

// Brand voice excerpt (kept compact; full voice lives in /branding/brand-voice.md)
export const BRAND_VOICE = `
MonzaHaus is an art-gallery salon for collector cars. Tone: authoritative, warm, concise.
Say "collector vehicle" not "old car". "Investment thesis" not "opinion". "Provenance" not
"history". Never use urgency pressure ("buy now!"), emojis, or guaranteed returns language.
Treat vehicles as investment assets with provenance and market position.
`.trim();

// Carousel dimensions
export const CAROUSEL = {
  width: 1080,
  height: 1350,
  slideCount: 5,
  deviceScaleFactor: 2,
};

export function isAllowedPlatform(p: string | null | undefined): p is AllowedPlatform {
  return p != null && (ALLOWED_PLATFORMS as readonly string[]).includes(p);
}
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors referencing `src/features/social-engine/`.

- [ ] **Step 6: Commit**

```bash
git add producto/supabase/migrations/20260418_create_social_post_drafts.sql producto/src/features/social-engine/types.ts producto/src/features/social-engine/config.ts
git commit -m "feat(social-engine): add migration + types + config scaffolding"
```

---

## Task 2: Draft repository

**Files:**
- Create: `producto/src/features/social-engine/repository/draftRepository.ts`

- [ ] **Step 1: Read existing Supabase client pattern**

Check how other features create Supabase clients. Grep:
```bash
grep -rn "createClient" producto/src/features/scrapers/porsche_ingest/ | head -5
grep -rn "SUPABASE_SERVICE_ROLE_KEY" producto/src | head -5
```
Follow the same pattern (service-role key for server-side writes).

- [ ] **Step 2: Create repository**

Create `producto/src/features/social-engine/repository/draftRepository.ts`:

```typescript
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { SocialPostDraft, DraftStatus, ErrorLogEntry } from "../types";

function makeClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE env vars for social-engine");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export interface CreateDraftInput {
  listing_id: string;
  quality_score: number;
  vision_score: number;
  vision_notes: string;
  selected_photo_indices: number[];
}

export class DraftRepository {
  constructor(private readonly client: SupabaseClient = makeClient()) {}

  async findByListingId(listing_id: string): Promise<SocialPostDraft | null> {
    const { data, error } = await this.client
      .from("social_post_drafts")
      .select("*")
      .eq("listing_id", listing_id)
      .maybeSingle();
    if (error) throw error;
    return (data as SocialPostDraft) ?? null;
  }

  async findById(id: string): Promise<SocialPostDraft | null> {
    const { data, error } = await this.client
      .from("social_post_drafts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as SocialPostDraft) ?? null;
  }

  async listByStatus(status: DraftStatus, limit = 50): Promise<SocialPostDraft[]> {
    const { data, error } = await this.client
      .from("social_post_drafts")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as SocialPostDraft[];
  }

  async create(input: CreateDraftInput): Promise<SocialPostDraft> {
    const { data, error } = await this.client
      .from("social_post_drafts")
      .insert({
        listing_id: input.listing_id,
        status: "pending_review",
        quality_score: input.quality_score,
        vision_score: input.vision_score,
        vision_notes: input.vision_notes,
        selected_photo_indices: input.selected_photo_indices,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as SocialPostDraft;
  }

  async updateStatus(id: string, status: DraftStatus): Promise<void> {
    const { error } = await this.client
      .from("social_post_drafts")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
  }

  async updateGeneration(
    id: string,
    slide_urls: string[],
    caption_draft: string,
    hashtags: string[],
  ): Promise<void> {
    const { error } = await this.client
      .from("social_post_drafts")
      .update({
        generated_slide_urls: slide_urls,
        caption_draft,
        hashtags,
        status: "ready",
      })
      .eq("id", id);
    if (error) throw error;
  }

  async updatePublished(
    id: string,
    ig_post_id: string,
    fb_post_id: string,
    ig_creation_id: string,
    caption_final: string,
  ): Promise<void> {
    const { error } = await this.client
      .from("social_post_drafts")
      .update({
        status: "published",
        ig_post_id,
        fb_post_id,
        ig_creation_id,
        caption_final,
        published_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  }

  async appendError(id: string, entry: ErrorLogEntry): Promise<void> {
    const existing = await this.findById(id);
    const log = (existing?.error_log as ErrorLogEntry[] | null) ?? [];
    log.push(entry);
    const { error } = await this.client
      .from("social_post_drafts")
      .update({ error_log: log, status: "failed" })
      .eq("id", id);
    if (error) throw error;
  }

  async discard(id: string, reason: string): Promise<void> {
    const { error } = await this.client
      .from("social_post_drafts")
      .update({
        status: "discarded",
        discarded_reason: reason,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  }
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add producto/src/features/social-engine/repository/draftRepository.ts
git commit -m "feat(social-engine): add draft repository"
```

---

## Task 3: Photo validator

**Files:**
- Create: `producto/src/features/social-engine/services/photoValidator.ts`
- Create: `producto/src/features/social-engine/services/photoValidator.test.ts`

- [ ] **Step 1: Write failing test**

Create `producto/src/features/social-engine/services/photoValidator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { filterRealPhotoUrls } from "./photoValidator";

describe("filterRealPhotoUrls", () => {
  it("keeps absolute https URLs", () => {
    const input = [
      "https://prod.pictures.autoscout24.net/listing-images/abc.jpg",
      "https://bringatrailer.com/wp-content/uploads/x.jpeg?fit=940,627",
    ];
    expect(filterRealPhotoUrls(input)).toEqual(input);
  });

  it("drops AS24 placeholder assets", () => {
    const input = [
      "https://prod.pictures.autoscout24.net/real.jpg",
      "/assets/as24-search-funnel/images/360/placeholder360.jpg",
      "/assets/as24-search-funnel/icons/360/three_sixty_icon.svg",
    ];
    expect(filterRealPhotoUrls(input)).toEqual([
      "https://prod.pictures.autoscout24.net/real.jpg",
    ]);
  });

  it("drops SVGs, placeholders, and non-absolute URLs", () => {
    const input = [
      "https://cdn.x.com/icon.svg",
      "https://cdn.x.com/image-placeholder.jpg",
      "/relative/path.jpg",
      "",
      null as unknown as string,
    ];
    expect(filterRealPhotoUrls(input)).toEqual([]);
  });

  it("returns empty array for null input", () => {
    expect(filterRealPhotoUrls(null)).toEqual([]);
    expect(filterRealPhotoUrls(undefined)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/social-engine/services/photoValidator.test.ts`
Expected: FAIL — "Cannot find module './photoValidator'".

- [ ] **Step 3: Write implementation**

Create `producto/src/features/social-engine/services/photoValidator.ts`:

```typescript
const UNACCEPTABLE_PATH_FRAGMENTS = [
  "/assets/",
  "placeholder",
  "/icons/",
];

export function filterRealPhotoUrls(urls: (string | null | undefined)[] | null | undefined): string[] {
  if (!urls) return [];
  return urls.filter((u): u is string => {
    if (!u || typeof u !== "string") return false;
    if (!u.startsWith("http")) return false;
    const lower = u.toLowerCase();
    if (lower.endsWith(".svg")) return false;
    if (UNACCEPTABLE_PATH_FRAGMENTS.some((f) => lower.includes(f))) return false;
    return true;
  });
}

export interface HeadCheckResult {
  ok: boolean;
  contentLength: number | null;
  contentType: string | null;
}

export async function headCheckPhoto(url: string, signal?: AbortSignal): Promise<HeadCheckResult> {
  try {
    const r = await fetch(url, { method: "HEAD", signal });
    const clRaw = r.headers.get("content-length");
    const contentLength = clRaw ? parseInt(clRaw, 10) : null;
    const contentType = r.headers.get("content-type");
    return {
      ok: r.ok && (contentType?.startsWith("image/") ?? false),
      contentLength,
      contentType,
    };
  } catch {
    return { ok: false, contentLength: null, contentType: null };
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/social-engine/services/photoValidator.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add producto/src/features/social-engine/services/photoValidator.ts producto/src/features/social-engine/services/photoValidator.test.ts
git commit -m "feat(social-engine): add photo URL validator + HEAD check"
```

---

## Task 4: Listing selector (Gate 1)

**Files:**
- Create: `producto/src/features/social-engine/services/listingSelector.ts`
- Create: `producto/src/features/social-engine/services/listingSelector.test.ts`

- [ ] **Step 1: Write failing test**

Create `producto/src/features/social-engine/services/listingSelector.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeQualityScore, matchesCollectorThesis } from "./listingSelector";
import type { ListingRow } from "../types";

function mockListing(overrides: Partial<ListingRow> = {}): ListingRow {
  return {
    id: "test-id",
    title: "2004 Porsche 911 GT3",
    year: 2004,
    make: "Porsche",
    model: "911",
    trim: "GT3",
    platform: "BRING_A_TRAILER",
    photos_count: 20,
    data_quality_score: 85,
    images: ["https://x.com/1.jpg"],
    final_price: null,
    current_bid: 150000,
    engine: "3.6-Liter Mezger Flat-Six",
    transmission: "Six-Speed Manual Transaxle",
    mileage: 40000,
    color_exterior: "Cobalt Blue",
    color_interior: null,
    location: "US",
    reserve_status: null,
    seller_notes: null,
    status: "active",
    created_at: "2026-04-15T00:00:00Z",
    ...overrides,
  };
}

describe("matchesCollectorThesis", () => {
  it("accepts GT3 by trim", () => {
    expect(matchesCollectorThesis(mockListing({ trim: "GT3" }))).toBe(true);
  });

  it("accepts RS by trim", () => {
    expect(matchesCollectorThesis(mockListing({ trim: "Carrera RS" }))).toBe(true);
  });

  it("accepts Speedster by title", () => {
    expect(matchesCollectorThesis(mockListing({ trim: null, title: "Porsche 911 Speedster" }))).toBe(true);
  });

  it("rejects modern Cayenne", () => {
    const l = mockListing({ trim: null, title: "Cayenne E-Hybrid", model: "Cayenne", year: 2024 });
    expect(matchesCollectorThesis(l)).toBe(false);
  });

  it("rejects Taycan 4S (RS false-positive)", () => {
    const l = mockListing({ trim: null, title: "Taycan 4S Cross Turismo", model: "Taycan", year: 2023 });
    expect(matchesCollectorThesis(l)).toBe(false);
  });
});

describe("computeQualityScore", () => {
  it("BaT GT3 with rich data scores high", () => {
    const score = computeQualityScore(mockListing());
    expect(score).toBeGreaterThan(70);
  });

  it("AS24 with null engine scores lower than BaT", () => {
    const as24 = computeQualityScore(mockListing({
      platform: "AUTO_SCOUT_24", engine: null, color_exterior: null,
    }));
    const bat = computeQualityScore(mockListing());
    expect(as24).toBeLessThan(bat);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

Run: `npx vitest run src/features/social-engine/services/listingSelector.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `producto/src/features/social-engine/services/listingSelector.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";
import type { ListingRow } from "../types";
import {
  ALLOWED_PLATFORMS,
  COLLECTOR_TRIM_REGEX,
  GATE_1,
  WORKER,
} from "../config";
import { extractSeries } from "@/lib/brandConfig";

const COLLECTOR_SERIES_IDS_SET = new Set([
  "964", "993", "997", "991", "992", "930", "718-cayman-gt4", "carrera-gt",
]);

export function matchesCollectorThesis(l: ListingRow): boolean {
  // 1) Trim-based match (GT3, GT2, RS as word boundary, Turbo S, Speedster, Carrera GT, Singer)
  const trim = (l.trim ?? "").trim();
  const title = (l.title ?? "").trim();
  if (trim && COLLECTOR_TRIM_REGEX.test(trim)) return true;

  // Title-based (but only with word-boundary RS to avoid "Taycan 4S RS" false positives)
  if (title && /\bGT3\b|\bGT2\b|\bCarrera RS\b|\bSpeedster\b|\bCarrera GT\b|\bSinger\b/i.test(title)) return true;

  // 2) Series-based match for Porsche (must be a collector generation)
  if (l.make === "Porsche" && l.model && l.year) {
    const series = extractSeries(l.model, l.year, l.make);
    if (series && COLLECTOR_SERIES_IDS_SET.has(series)) return true;
  }

  return false;
}

// Heuristic: source quality (0-40), data completeness (0-40), photos_count (0-20)
export function computeQualityScore(l: ListingRow): number {
  let score = 0;
  if (l.platform === "ELFERSPOT") score += 40;
  else if (l.platform === "BRING_A_TRAILER") score += 32;
  else if (l.platform === "AUTO_SCOUT_24") score += 20;

  const fields: (keyof ListingRow)[] = [
    "engine", "transmission", "mileage", "color_exterior", "location",
  ];
  for (const f of fields) if (l[f] != null && l[f] !== "") score += 8;

  if (l.photos_count != null) {
    score += Math.min(20, Math.floor((l.photos_count / 50) * 20));
  }
  return Math.min(100, score);
}

function makeClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function fetchGate1Candidates(): Promise<ListingRow[]> {
  const supa = makeClient();
  const cutoff = new Date(Date.now() - GATE_1.lookbackDays * 864e5).toISOString();

  // Fetch with broad filter, then refine in JS (Postgres can't call extractSeries).
  const { data, error } = await supa
    .from("listings")
    .select(
      "id, title, year, make, model, trim, platform, status, photos_count, data_quality_score, images, final_price, current_bid, engine, transmission, mileage, color_exterior, color_interior, location, reserve_status, seller_notes, created_at",
    )
    .eq("status", "active")
    .in("platform", ALLOWED_PLATFORMS as unknown as string[])
    .gte("photos_count", GATE_1.minPhotosCount)
    .gte("data_quality_score", GATE_1.minDataQualityScore)
    .gte("created_at", cutoff)
    .eq("make", "Porsche")
    .order("data_quality_score", { ascending: false })
    .limit(WORKER.maxCandidatesFromGate1 * 3);
  if (error) throw error;

  // Exclude listings that already have a draft
  const listingIds = (data ?? []).map((r) => r.id);
  if (listingIds.length === 0) return [];

  const { data: existing, error: e2 } = await supa
    .from("social_post_drafts")
    .select("listing_id")
    .in("listing_id", listingIds);
  if (e2) throw e2;
  const existingIds = new Set((existing ?? []).map((r) => r.listing_id));

  const filtered = (data ?? [])
    .filter((r) => !existingIds.has(r.id))
    .filter((r) => matchesCollectorThesis(r as ListingRow));

  // Sort by heuristic quality score, cap to maxCandidates
  return filtered
    .map((r) => ({ row: r as ListingRow, score: computeQualityScore(r as ListingRow) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, WORKER.maxCandidatesFromGate1)
    .map((x) => x.row);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/social-engine/services/listingSelector.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add producto/src/features/social-engine/services/listingSelector.ts producto/src/features/social-engine/services/listingSelector.test.ts
git commit -m "feat(social-engine): add Gate 1 listing selector with thesis match + quality scoring"
```

---

## Task 5: Vision scorer (Gate 2)

**Files:**
- Create: `producto/src/features/social-engine/services/visionScorer.ts`
- Create: `producto/src/features/social-engine/services/visionScorer.test.ts`

- [ ] **Step 1: Write failing test**

Create `producto/src/features/social-engine/services/visionScorer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseVisionResponse, buildVisionPrompt } from "./visionScorer";

describe("buildVisionPrompt", () => {
  it("includes all scoring criteria", () => {
    const p = buildVisionPrompt(3);
    expect(p).toContain("framing");
    expect(p).toContain("lighting");
    expect(p).toContain("setting");
    expect(p).toContain("completeness");
    expect(p).toContain("watermarks");
    expect(p).toContain("JSON");
    expect(p).toContain("0-100");
  });
});

describe("parseVisionResponse", () => {
  it("parses valid JSON response", () => {
    const raw = '```json\n{"score": 85, "reasons": ["clean studio background", "sharp focus"], "best_photo_index": 0, "recommended_indices": [0, 2, 1]}\n```';
    const out = parseVisionResponse(raw, 5);
    expect(out.score).toBe(85);
    expect(out.best_photo_index).toBe(0);
    expect(out.recommended_indices).toEqual([0, 2, 1]);
  });

  it("parses JSON without code fences", () => {
    const raw = '{"score": 40, "reasons": ["blurry"], "best_photo_index": 0, "recommended_indices": [0]}';
    expect(parseVisionResponse(raw, 3).score).toBe(40);
  });

  it("clamps indices to image count", () => {
    const raw = '{"score": 80, "reasons": [], "best_photo_index": 99, "recommended_indices": [10, 20]}';
    const out = parseVisionResponse(raw, 5);
    expect(out.best_photo_index).toBeLessThan(5);
    expect(out.recommended_indices.every((i) => i < 5)).toBe(true);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseVisionResponse("not json", 3)).toThrow();
  });
});
```

- [ ] **Step 2: Run test, verify failure**

Run: `npx vitest run src/features/social-engine/services/visionScorer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `producto/src/features/social-engine/services/visionScorer.ts`:

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GATE_2 } from "../config";
import type { VisionScore } from "../types";

export function buildVisionPrompt(photoCount: number): string {
  return `You are evaluating ${photoCount} photos of a collector vehicle for editorial social-media use on a premium brand (think salon/art gallery, not marketplace).

Score the set as a whole on a 0-100 scale considering:
- framing and composition (centered, rule of thirds, varied angles)
- lighting quality (professional lighting vs. harsh/flash/dim)
- setting/background (studio, premium location, driveway vs. cluttered parking lot, people in shot)
- vehicle completeness (full body shots + detail shots; not only interior)
- absence of watermarks, text overlays, dealership banners, visual clutter

Return ONLY a JSON object, no prose, no code fences:
{
  "score": <int 0-100>,
  "reasons": [<2-4 short strings explaining the score>],
  "best_photo_index": <int index 0..${photoCount - 1}>,
  "recommended_indices": [<array of up to 4 indices in order of preference, each 0..${photoCount - 1}>]
}`;
}

export function parseVisionResponse(raw: string, photoCount: number): VisionScore {
  // Strip code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as Partial<VisionScore>;

  if (typeof parsed.score !== "number") throw new Error("vision: missing score");
  const clamp = (i: number) => Math.max(0, Math.min(photoCount - 1, Math.floor(i)));
  return {
    score: Math.max(0, Math.min(100, parsed.score)),
    reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map(String) : [],
    best_photo_index: clamp(parsed.best_photo_index ?? 0),
    recommended_indices: Array.isArray(parsed.recommended_indices)
      ? Array.from(new Set(parsed.recommended_indices.map(Number).map(clamp)))
      : [0],
  };
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch image: ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const mimeType = r.headers.get("content-type") ?? "image/jpeg";
  return { data: buf.toString("base64"), mimeType };
}

export async function scorePhotos(photoUrls: string[]): Promise<VisionScore> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY)");

  const sample = photoUrls.slice(0, GATE_2.photoSampleSize);
  const images = await Promise.all(sample.map(fetchImageAsBase64));

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({ model: GATE_2.gateModel });
  const prompt = buildVisionPrompt(sample.length);

  const result = await model.generateContent([
    prompt,
    ...images.map((img) => ({
      inlineData: { data: img.data, mimeType: img.mimeType },
    })),
  ]);
  const text = result.response.text();
  return parseVisionResponse(text, photoUrls.length);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/social-engine/services/visionScorer.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add producto/src/features/social-engine/services/visionScorer.ts producto/src/features/social-engine/services/visionScorer.test.ts
git commit -m "feat(social-engine): add Gemini vision scorer (Gate 2)"
```

---

## Task 6: Worker orchestrator + CLI entry

**Files:**
- Create: `producto/src/features/social-engine/workers/worker.ts`
- Create: `producto/scripts/social-engine-worker.ts`

- [ ] **Step 1: Write worker module**

Create `producto/src/features/social-engine/workers/worker.ts`:

```typescript
import { fetchGate1Candidates, computeQualityScore } from "../services/listingSelector";
import { filterRealPhotoUrls, headCheckPhoto } from "../services/photoValidator";
import { scorePhotos } from "../services/visionScorer";
import { DraftRepository } from "../repository/draftRepository";
import { GATE_1, GATE_2, WORKER } from "../config";
import type { ListingRow } from "../types";

export interface WorkerResult {
  candidates: number;
  afterGate1: number;
  afterGate2: number;
  draftsCreated: number;
  errors: { listing_id: string; stage: string; message: string }[];
}

function log(component: string, event: string, details: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ component, event, ...details }));
}

export async function runWorker(
  repo: DraftRepository = new DraftRepository(),
): Promise<WorkerResult> {
  const result: WorkerResult = {
    candidates: 0,
    afterGate1: 0,
    afterGate2: 0,
    draftsCreated: 0,
    errors: [],
  };

  log("worker", "started");
  const candidates = await fetchGate1Candidates();
  result.candidates = candidates.length;
  log("worker", "gate1_complete", { count: candidates.length });

  for (const listing of candidates) {
    if (result.draftsCreated >= WORKER.maxDraftsPerRun) break;

    const realPhotos = filterRealPhotoUrls(listing.images ?? []);
    if (realPhotos.length < GATE_1.minPhotosCount) {
      log("worker", "drop_not_enough_real_photos", { listing_id: listing.id, real: realPhotos.length });
      continue;
    }

    // Puerta 1 refinement — HEAD check on first photo
    const head = await headCheckPhoto(realPhotos[0]).catch(() => null);
    if (!head?.ok || (head.contentLength ?? 0) < GATE_1.minImageBytes) {
      log("worker", "drop_head_check_failed", {
        listing_id: listing.id,
        contentLength: head?.contentLength ?? null,
      });
      continue;
    }
    result.afterGate1 += 1;

    // Puerta 2 — vision scoring
    let vision;
    try {
      vision = await scorePhotos(realPhotos);
    } catch (err) {
      const message = (err as Error).message;
      log("worker", "vision_error", { listing_id: listing.id, message });
      result.errors.push({ listing_id: listing.id, stage: "vision", message });
      continue;
    }

    if (vision.score < GATE_2.visionThreshold) {
      log("worker", "drop_vision_below_threshold", {
        listing_id: listing.id, vision_score: vision.score,
      });
      continue;
    }
    result.afterGate2 += 1;

    try {
      await repo.create({
        listing_id: listing.id,
        quality_score: computeQualityScore(listing),
        vision_score: vision.score,
        vision_notes: vision.reasons.join(" · "),
        selected_photo_indices: vision.recommended_indices,
      });
      result.draftsCreated += 1;
      log("worker", "draft_created", { listing_id: listing.id, vision_score: vision.score });
    } catch (err) {
      const message = (err as Error).message;
      log("worker", "draft_insert_error", { listing_id: listing.id, message });
      result.errors.push({ listing_id: listing.id, stage: "insert", message });
    }
  }

  log("worker", "completed", result);
  return result;
}
```

- [ ] **Step 2: Create CLI entry**

Create `producto/scripts/social-engine-worker.ts`:

```typescript
#!/usr/bin/env tsx
/**
 * CLI entry for the MonzaHaus Social Engine worker.
 * Mirrors the pattern of ingest-porsche.ts — can be run locally with tsx
 * or remotely via /api/cron/social-engine (see Task 15).
 *
 * Usage:
 *   npx tsx producto/scripts/social-engine-worker.ts
 */

import { runWorker } from "../src/features/social-engine/workers/worker";

async function main() {
  try {
    const result = await runWorker();
    console.log("\n=== Worker Result ===");
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("Worker failed:", err);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 3: Test manually (optional but recommended)**

With DB + env vars configured:
```bash
cd producto && npx tsx scripts/social-engine-worker.ts
```
Expected: JSON log lines, then `=== Worker Result ===` with counts. No drafts created if no collector listings in last 7 days — that's fine.

- [ ] **Step 4: Commit**

```bash
git add producto/src/features/social-engine/workers/worker.ts producto/scripts/social-engine-worker.ts
git commit -m "feat(social-engine): add worker orchestrator + CLI entry"
```

---

## Task 7: Comparables service + caption generator

**Files:**
- Create: `producto/src/features/social-engine/services/comparablesService.ts`
- Create: `producto/src/features/social-engine/services/captionGenerator.ts`
- Create: `producto/src/features/social-engine/services/captionGenerator.test.ts`

- [ ] **Step 1: Implement comparables service**

Create `producto/src/features/social-engine/services/comparablesService.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";
import type { ListingRow, ComparablesSummary } from "../types";

function makeClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

const COMP_WINDOW_MONTHS = 12;
const MIN_SAMPLE_SIZE = 3;

export async function fetchComparablesSummary(listing: ListingRow): Promise<ComparablesSummary | null> {
  if (!listing.make || !listing.model || !listing.year) return null;
  const supa = makeClient();
  const cutoff = new Date(Date.now() - COMP_WINDOW_MONTHS * 30 * 864e5).toISOString();

  const yearLow = listing.year - 2;
  const yearHigh = listing.year + 2;

  const { data, error } = await supa
    .from("listings")
    .select("final_price, current_bid, sale_date")
    .eq("make", listing.make)
    .eq("model", listing.model)
    .gte("year", yearLow)
    .lte("year", yearHigh)
    .neq("id", listing.id)
    .in("status", ["sold", "ended"])
    .gte("sale_date", cutoff)
    .not("final_price", "is", null);
  if (error) throw error;

  const prices = (data ?? [])
    .map((r) => r.final_price as number)
    .filter((p) => p != null && p > 0);

  if (prices.length < MIN_SAMPLE_SIZE) return null;

  prices.sort((a, b) => a - b);
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const low = prices[0];
  const high = prices[prices.length - 1];

  const thisPrice = listing.final_price ?? listing.current_bid ?? null;
  const deltaPct = thisPrice != null ? ((thisPrice - avg) / avg) * 100 : null;

  return {
    avg,
    low,
    high,
    sampleSize: prices.length,
    windowMonths: COMP_WINDOW_MONTHS,
    thisPrice,
    deltaPct: deltaPct != null ? Math.round(deltaPct * 10) / 10 : null,
  };
}
```

- [ ] **Step 2: Write caption generator test**

Create `producto/src/features/social-engine/services/captionGenerator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildCaptionPrompt, parseCaptionResponse } from "./captionGenerator";
import type { ListingRow, ComparablesSummary } from "../types";

const LISTING: ListingRow = {
  id: "abc-123",
  title: "40k-Mile 2004 Porsche 911 GT3",
  year: 2004,
  make: "Porsche",
  model: "911",
  trim: "GT3",
  platform: "BRING_A_TRAILER",
  photos_count: 10,
  data_quality_score: 90,
  images: [],
  final_price: null,
  current_bid: 165000,
  engine: "3.6-Liter Mezger Flat-Six",
  transmission: "Six-Speed Manual Transaxle",
  mileage: 40000,
  color_exterior: "Cobalt Blue",
  color_interior: null,
  location: "United States",
  reserve_status: null,
  seller_notes: null,
  status: "active",
  created_at: "2026-04-15T00:00:00Z",
};

const COMPS: ComparablesSummary = {
  avg: 152000, low: 128000, high: 195000,
  sampleSize: 14, windowMonths: 12,
  thisPrice: 165000, deltaPct: 8.5,
};

describe("buildCaptionPrompt", () => {
  it("includes listing details and comparables", () => {
    const p = buildCaptionPrompt(LISTING, COMPS, "The 996.1 GT3 is...");
    expect(p).toContain("Mezger");
    expect(p).toContain("152000");
    expect(p).toContain("monzahaus.com");
  });

  it("works when comparables are null", () => {
    const p = buildCaptionPrompt(LISTING, null, "thesis");
    expect(p).toContain("Mezger");
    expect(p.toLowerCase()).toContain("no recent comparables");
  });
});

describe("parseCaptionResponse", () => {
  it("parses valid JSON", () => {
    const raw = '{"caption": "A Mezger GT3.\\n\\nClean example.\\n\\nFull report at monzahaus.com/cars/porsche/abc-123/report", "hashtags": ["mezger", "gt3"]}';
    const out = parseCaptionResponse(raw);
    expect(out.caption).toContain("Mezger");
    expect(out.hashtags).toEqual(["mezger", "gt3"]);
  });

  it("strips code fences", () => {
    const raw = '```json\n{"caption": "x", "hashtags": []}\n```';
    expect(parseCaptionResponse(raw).caption).toBe("x");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseCaptionResponse("bad")).toThrow();
  });
});
```

- [ ] **Step 3: Run test, verify failure**

Run: `npx vitest run src/features/social-engine/services/captionGenerator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement caption generator**

Create `producto/src/features/social-engine/services/captionGenerator.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { BRAND_VOICE } from "../config";
import type { ListingRow, ComparablesSummary, CaptionOutput } from "../types";

const CLAUDE_MODEL = "claude-sonnet-4-6"; // latest Sonnet as of 2026-04. Update if Anthropic releases newer.

export function buildReportUrl(listing: ListingRow): string {
  const makeSlug = (listing.make ?? "unknown").toLowerCase().replace(/\s+/g, "-");
  return `monzahaus.com/cars/${makeSlug}/${listing.id}/report`;
}

export function buildCaptionPrompt(
  listing: ListingRow,
  comps: ComparablesSummary | null,
  thesis: string,
): string {
  const url = buildReportUrl(listing);
  const compsSection = comps
    ? `Recent comparables: ${comps.sampleSize} sold in last ${comps.windowMonths}mo. Avg $${comps.avg}. Range $${comps.low}–$${comps.high}. This listing at $${comps.thisPrice ?? "?"} is ${comps.deltaPct != null ? (comps.deltaPct > 0 ? "+" : "") + comps.deltaPct + "% vs avg" : "n/a"}.`
    : `No recent comparables available.`;

  return `You are writing an Instagram + Facebook caption for MonzaHaus, a collector-car salon.

BRAND VOICE:
${BRAND_VOICE}

LISTING:
- Title: ${listing.title ?? ""}
- Year / Make / Model / Trim: ${listing.year} ${listing.make} ${listing.model} ${listing.trim ?? ""}
- Engine: ${listing.engine ?? "n/a"}
- Gearbox: ${listing.transmission ?? "n/a"}
- Mileage: ${listing.mileage ?? "n/a"}
- Exterior: ${listing.color_exterior ?? "n/a"}
- Platform: ${listing.platform}
- Asking / current bid: $${listing.current_bid ?? listing.final_price ?? "n/a"}

MARKET CONTEXT:
${compsSection}

INVESTMENT THESIS FOR THIS SERIES:
${thesis}

WRITE A CAPTION:
- 3–4 short lines (max ~60 words total)
- One hook line, one market/thesis insight, one invitation
- MUST end with exactly: "Full report at ${url}"
- No emojis, no hashtags in the caption body, no "link in bio", no urgency words
- Tone: confident, investment-minded, warm, concise

Return ONLY a JSON object, no prose, no code fences:
{
  "caption": "<the caption as a single string with \\n between lines>",
  "hashtags": [<0 to 3 curated lowercase strings without '#'>]
}`;
}

export function parseCaptionResponse(raw: string): CaptionOutput {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as Partial<CaptionOutput>;
  if (typeof parsed.caption !== "string") throw new Error("caption: missing caption");
  return {
    caption: parsed.caption,
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String).slice(0, 3) : [],
  };
}

export async function generateCaption(
  listing: ListingRow,
  comps: ComparablesSummary | null,
  thesis: string,
): Promise<CaptionOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const client = new Anthropic({ apiKey });
  const resp = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 600,
    messages: [{ role: "user", content: buildCaptionPrompt(listing, comps, thesis) }],
  });

  const textBlock = resp.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("caption: no text in response");
  return parseCaptionResponse(textBlock.text);
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/features/social-engine/services/captionGenerator.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add producto/src/features/social-engine/services/comparablesService.ts producto/src/features/social-engine/services/captionGenerator.ts producto/src/features/social-engine/services/captionGenerator.test.ts
git commit -m "feat(social-engine): add comparables fetcher + Claude caption generator"
```

---

## Task 8: Brand tokens + shared slide frame + Slide 1 + Slide 2

**Files:**
- Create: `producto/src/features/social-engine/styles/brand-tokens.css`
- Create: `producto/src/features/social-engine/templates/CarouselV1/templateData.ts`
- Create: `producto/src/features/social-engine/templates/CarouselV1/SlideFrame.tsx`
- Create: `producto/src/features/social-engine/templates/CarouselV1/Slide1Cover.tsx`
- Create: `producto/src/features/social-engine/templates/CarouselV1/Slide2Specs.tsx`
- Create: `producto/src/app/internal/carousel/[draftId]/[slideIdx]/page.tsx`

- [ ] **Step 1: Copy brand tokens**

Copy `branding/tokens.css` (at workspace root, outside `/producto/`) into the project:

```bash
cp ../branding/tokens.css producto/src/features/social-engine/styles/brand-tokens.css
```

If `../branding/tokens.css` is missing, create a minimal token file from the visual mockup (`docs/superpowers/specs/assets/2026-04-18-social-carousel-mockup.html`) — extract the `:root` variables from its `<style>` block.

- [ ] **Step 2: Create templateData types**

Create `producto/src/features/social-engine/templates/CarouselV1/templateData.ts`:

```typescript
import type { ListingRow, ComparablesSummary } from "../../types";

export interface SlideData {
  listing: ListingRow;
  comps: ComparablesSummary | null;
  thesis: string;
  photoUrls: string[]; // already filtered to real URLs
  selectedIndices: number[];
}

export function pickPhoto(data: SlideData, slotIdx: number): string {
  const idx = data.selectedIndices[slotIdx] ?? slotIdx;
  return data.photoUrls[idx] ?? data.photoUrls[0] ?? "";
}
```

- [ ] **Step 3: Create SlideFrame**

Create `producto/src/features/social-engine/templates/CarouselV1/SlideFrame.tsx`:

```typescript
import "../../styles/brand-tokens.css";
import type { ReactNode } from "react";

export function SlideFrame({ children, theme = "dark" }: { children: ReactNode; theme?: "dark" | "light" | "rose" }) {
  const bg =
    theme === "dark" ? "var(--obsidian, #0E0A0C)"
    : theme === "light" ? "var(--cream, #FDFBF9)"
    : "linear-gradient(140deg, #5C1A33 0%, #7A2E4A 50%, #8d3a56 100%)";
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant:wght@300;400;500;600&family=Karla:wght@300;400;500;600;700&family=Geist+Mono&display=block"
      />
      <div
        style={{
          width: 1080,
          height: 1350,
          position: "relative",
          overflow: "hidden",
          background: bg,
          fontFamily: "Karla, sans-serif",
          color: theme === "light" ? "#2A2320" : "#E8E2DE",
        }}
      >
        {children}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Create Slide1Cover**

Create `producto/src/features/social-engine/templates/CarouselV1/Slide1Cover.tsx`:

```typescript
import { SlideFrame } from "./SlideFrame";
import { pickPhoto, type SlideData } from "./templateData";

export function Slide1Cover({ data }: { data: SlideData }) {
  const photo = pickPhoto(data, 0);
  const title = `${data.listing.year ?? ""} ${data.listing.make ?? ""} ${data.listing.model ?? ""} ${data.listing.trim ?? ""}`.replace(/\s+/g, " ").trim();

  return (
    <SlideFrame theme="dark">
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `url(${photo})`,
        backgroundSize: "cover", backgroundPosition: "center",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 50%, rgba(14,10,12,0.9) 100%)",
      }} />

      <div style={{
        position: "absolute", top: 64, left: 64, zIndex: 2,
        fontSize: 22, fontWeight: 500, letterSpacing: "0.25em",
        textTransform: "uppercase", color: "#D4738A",
      }}>
        New Listing
      </div>
      <div style={{
        position: "absolute", top: 64, right: 64, zIndex: 2,
        fontFamily: "Cormorant, serif", fontWeight: 500, fontSize: 36,
        letterSpacing: "-0.02em", color: "#E8E2DE",
      }}>
        MonzaHaus
      </div>

      <div style={{
        position: "absolute", bottom: 80, left: 64, right: 64, zIndex: 2,
      }}>
        <div style={{
          fontFamily: "Cormorant, serif", fontWeight: 300, fontSize: 96,
          lineHeight: 1.05, letterSpacing: "-0.02em", color: "#E8E2DE",
        }}>
          {title}
        </div>
        <div style={{
          marginTop: 24, fontSize: 22, letterSpacing: "0.2em",
          textTransform: "uppercase", color: "#9A8E88",
        }}>
          via {data.listing.platform?.replace(/_/g, " ").toLowerCase()} · {data.listing.location ?? "location unavailable"}
        </div>
      </div>
    </SlideFrame>
  );
}
```

- [ ] **Step 5: Create Slide2Specs**

Create `producto/src/features/social-engine/templates/CarouselV1/Slide2Specs.tsx`:

```typescript
import { SlideFrame } from "./SlideFrame";
import { pickPhoto, type SlideData } from "./templateData";

function SpecRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 8,
      paddingBottom: 28, borderBottom: "1px solid #2A2226",
    }}>
      <div style={{
        fontSize: 18, fontWeight: 500, letterSpacing: "0.25em",
        textTransform: "uppercase", color: "#9A8E88",
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "Cormorant, serif", fontWeight: 400, fontSize: 38,
        letterSpacing: "-0.01em", color: "#E8E2DE",
      }}>
        {value}
      </div>
    </div>
  );
}

export function Slide2Specs({ data }: { data: SlideData }) {
  const photo = pickPhoto(data, 1);
  const l = data.listing;
  const price = l.final_price ?? l.current_bid;

  return (
    <SlideFrame theme="dark">
      <div style={{ display: "flex", height: "100%" }}>
        <div style={{
          flex: "0 0 50%",
          backgroundImage: `url(${photo})`, backgroundSize: "cover", backgroundPosition: "center",
          position: "relative",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to right, rgba(14,10,12,0) 70%, rgba(14,10,12,0.9) 100%)",
          }} />
        </div>
        <div style={{
          flex: 1, padding: "72px 56px",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
        }}>
          <div style={{
            fontSize: 20, fontWeight: 500, letterSpacing: "0.25em",
            textTransform: "uppercase", color: "#D4738A",
          }}>The Car</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
            <SpecRow label="Engine" value={l.engine} />
            <SpecRow label="Gearbox" value={l.transmission} />
            <SpecRow label="Mileage" value={l.mileage != null ? `${l.mileage.toLocaleString()} mi` : null} />
            <SpecRow label="Exterior" value={l.color_exterior} />
            {price != null && <SpecRow label="Price" value={`$${price.toLocaleString()}`} />}
          </div>
          <div style={{
            fontSize: 18, letterSpacing: "0.2em",
            textTransform: "uppercase", color: "#9A8E88",
          }}>
            Live on {l.platform?.replace(/_/g, " ").toLowerCase()}
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}
```

- [ ] **Step 6: Create internal carousel preview route**

Create `producto/src/app/internal/carousel/[draftId]/[slideIdx]/page.tsx`:

```typescript
/* eslint-disable react-hooks/rules-of-hooks */
// This route is INTERNAL — only used by Puppeteer to render slides.
// Not linked from UI. Access should be limited (optionally gate with CRON_SECRET header).

import { DraftRepository } from "@/features/social-engine/repository/draftRepository";
import { createClient } from "@supabase/supabase-js";
import { filterRealPhotoUrls } from "@/features/social-engine/services/photoValidator";
import { fetchComparablesSummary } from "@/features/social-engine/services/comparablesService";
import { getSeriesThesis, extractSeries } from "@/lib/brandConfig";
import { Slide1Cover } from "@/features/social-engine/templates/CarouselV1/Slide1Cover";
import { Slide2Specs } from "@/features/social-engine/templates/CarouselV1/Slide2Specs";
import { Slide3Market } from "@/features/social-engine/templates/CarouselV1/Slide3Market";
import { Slide4Story } from "@/features/social-engine/templates/CarouselV1/Slide4Story";
import { Slide5CTA } from "@/features/social-engine/templates/CarouselV1/Slide5CTA";
import type { SlideData } from "@/features/social-engine/templates/CarouselV1/templateData";
import type { ListingRow } from "@/features/social-engine/types";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function loadSlideData(draftId: string): Promise<SlideData | null> {
  const repo = new DraftRepository();
  const draft = await repo.findById(draftId);
  if (!draft) return null;

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: listing } = await supa.from("listings").select("*").eq("id", draft.listing_id).single();
  if (!listing) return null;

  const typed = listing as ListingRow;
  const photoUrls = filterRealPhotoUrls(typed.images ?? []);
  const comps = await fetchComparablesSummary(typed).catch(() => null);

  let thesis = "A collector-grade example worth close examination.";
  if (typed.make === "Porsche" && typed.model && typed.year) {
    const series = extractSeries(typed.model, typed.year, typed.make);
    if (series) {
      const t = getSeriesThesis(series, typed.make);
      if (t) thesis = t;
    }
  }

  return {
    listing: typed,
    comps,
    thesis,
    photoUrls,
    selectedIndices: draft.selected_photo_indices ?? [0, 1, 2, 3],
  };
}

export default async function Page({ params }: { params: Promise<{ draftId: string; slideIdx: string }> }) {
  const { draftId, slideIdx } = await params;
  const idx = parseInt(slideIdx, 10);
  const data = await loadSlideData(draftId);
  if (!data) notFound();

  switch (idx) {
    case 1: return <Slide1Cover data={data} />;
    case 2: return <Slide2Specs data={data} />;
    case 3: return <Slide3Market data={data} />;
    case 4: return <Slide4Story data={data} />;
    case 5: return <Slide5CTA data={data} />;
    default: notFound();
  }
}
```

Note: Slide3, Slide4, Slide5 are created in Task 9. The route already imports them — until Task 9 is done the build will fail on those imports. That's expected; commit Task 8 only after adding empty stubs.

- [ ] **Step 7: Add empty stubs for slides 3-5**

So the route compiles. Create placeholders:

`producto/src/features/social-engine/templates/CarouselV1/Slide3Market.tsx`:
```typescript
import { SlideFrame } from "./SlideFrame";
import type { SlideData } from "./templateData";
export function Slide3Market({ data: _data }: { data: SlideData }) {
  return <SlideFrame theme="rose"><div style={{ padding: 48 }}>Slide 3 — TBD in Task 9</div></SlideFrame>;
}
```

`producto/src/features/social-engine/templates/CarouselV1/Slide4Story.tsx`:
```typescript
import { SlideFrame } from "./SlideFrame";
import type { SlideData } from "./templateData";
export function Slide4Story({ data: _data }: { data: SlideData }) {
  return <SlideFrame theme="light"><div style={{ padding: 48 }}>Slide 4 — TBD in Task 9</div></SlideFrame>;
}
```

`producto/src/features/social-engine/templates/CarouselV1/Slide5CTA.tsx`:
```typescript
import { SlideFrame } from "./SlideFrame";
import type { SlideData } from "./templateData";
export function Slide5CTA({ data: _data }: { data: SlideData }) {
  return <SlideFrame theme="dark"><div style={{ padding: 48 }}>Slide 5 — TBD in Task 9</div></SlideFrame>;
}
```

- [ ] **Step 8: Verify compile**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | grep social-engine | head -10`
Expected: No errors from `social-engine/`.

- [ ] **Step 9: Commit**

```bash
git add producto/src/features/social-engine/styles producto/src/features/social-engine/templates producto/src/app/internal/carousel
git commit -m "feat(social-engine): add slide frame + Slide 1/2 + internal render route + stubs"
```

---

## Task 9: Slide 3 (Market) + Slide 4 (Story) + Slide 5 (CTA)

**Files:**
- Modify: `producto/src/features/social-engine/templates/CarouselV1/Slide3Market.tsx`
- Modify: `producto/src/features/social-engine/templates/CarouselV1/Slide4Story.tsx`
- Modify: `producto/src/features/social-engine/templates/CarouselV1/Slide5CTA.tsx`

- [ ] **Step 1: Implement Slide3Market**

Replace `producto/src/features/social-engine/templates/CarouselV1/Slide3Market.tsx` with:

```typescript
import { SlideFrame } from "./SlideFrame";
import type { SlideData } from "./templateData";

export function Slide3Market({ data }: { data: SlideData }) {
  const { comps } = data;

  if (!comps) {
    return (
      <SlideFrame theme="rose">
        <div style={{ padding: "96px 72px", display: "flex", flexDirection: "column", gap: 36 }}>
          <div style={{
            fontSize: 22, fontWeight: 500, letterSpacing: "0.25em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.7)",
          }}>
            Market Position
          </div>
          <div style={{
            fontFamily: "Cormorant, serif", fontWeight: 400, fontSize: 72,
            lineHeight: 1.15, color: "#fff",
          }}>
            A rare enough car that there are not enough recent comparables to triangulate.
          </div>
          <div style={{ fontSize: 20, color: "rgba(255,255,255,0.7)" }}>
            Scarcity itself is the thesis.
          </div>
        </div>
      </SlideFrame>
    );
  }

  const positionPct = comps.thisPrice != null
    ? Math.min(100, Math.max(0, ((comps.thisPrice - comps.low) / (comps.high - comps.low)) * 100))
    : 50;
  const isPositive = (comps.deltaPct ?? 0) >= 0;

  return (
    <SlideFrame theme="rose">
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(60% 40% at 80% 20%, rgba(255,255,255,0.12) 0%, transparent 60%)",
      }} />

      <div style={{
        position: "relative", height: "100%",
        padding: "96px 72px", display: "flex", flexDirection: "column", justifyContent: "space-between",
      }}>
        <div style={{
          fontSize: 22, fontWeight: 500, letterSpacing: "0.25em",
          textTransform: "uppercase", color: "rgba(255,255,255,0.7)",
        }}>
          Market Position
        </div>

        <div>
          <div style={{
            fontSize: 22, letterSpacing: "0.15em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.6)", marginBottom: 12,
          }}>
            Last {comps.windowMonths} months · {comps.sampleSize} comparables
          </div>
          <div style={{
            fontFamily: "Cormorant, serif", fontWeight: 500, fontSize: 130,
            color: "#fff", letterSpacing: "-0.02em", lineHeight: 1,
          }}>
            ${Math.round(comps.avg / 1000)}k
          </div>
          <div style={{ fontSize: 22, color: "rgba(255,255,255,0.75)", marginTop: 28, lineHeight: 1.5 }}>
            Average clearing price for comparable examples in recent sales.
          </div>

          <div style={{ marginTop: 48 }}>
            <div style={{ position: "relative", height: 4, background: "rgba(255,255,255,0.2)" }}>
              <div style={{
                position: "absolute", top: -10, left: `${positionPct}%`,
                width: 4, height: 24, background: "#34D399",
                transform: "translateX(-50%)",
              }} />
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between", marginTop: 16,
              fontFamily: "Geist Mono, monospace", fontSize: 20, color: "rgba(255,255,255,0.7)",
            }}>
              <span>${Math.round(comps.low / 1000)}k</span>
              <span>${Math.round(comps.high / 1000)}k</span>
            </div>
          </div>

          {comps.deltaPct != null && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              marginTop: 40, padding: "12px 24px",
              background: isPositive ? "rgba(52,211,153,0.15)" : "rgba(251,146,60,0.15)",
              border: `1px solid ${isPositive ? "rgba(52,211,153,0.4)" : "rgba(251,146,60,0.4)"}`,
              borderRadius: 40,
              fontFamily: "Geist Mono, monospace", fontSize: 22,
              color: isPositive ? "#34D399" : "#FB923C",
            }}>
              {isPositive ? "▲" : "▼"} {Math.abs(comps.deltaPct)}% vs avg
            </div>
          )}
        </div>

        <div style={{
          fontSize: 20, letterSpacing: "0.2em", textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)",
        }}>
          MonzaHaus · market intelligence
        </div>
      </div>
    </SlideFrame>
  );
}
```

- [ ] **Step 2: Implement Slide4Story**

Replace `producto/src/features/social-engine/templates/CarouselV1/Slide4Story.tsx` with:

```typescript
import { SlideFrame } from "./SlideFrame";
import { pickPhoto, type SlideData } from "./templateData";

export function Slide4Story({ data }: { data: SlideData }) {
  const photo = pickPhoto(data, 2);
  const l = data.listing;

  const facts = [
    l.mileage != null ? `${l.mileage.toLocaleString()} documented miles` : null,
    l.color_exterior ? `Original paint · ${l.color_exterior}` : null,
    l.engine && l.transmission ? `${l.engine} · ${l.transmission}` : null,
    l.platform === "BRING_A_TRAILER" ? "Listed via Bring a Trailer" : null,
  ].filter(Boolean) as string[];

  return (
    <SlideFrame theme="light">
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "45%",
        backgroundImage: `url(${photo})`, backgroundSize: "cover", backgroundPosition: "center",
      }} />
      <div style={{
        position: "absolute", top: "45%", left: 0, right: 0, bottom: 0,
        padding: "64px 72px", display: "flex", flexDirection: "column", justifyContent: "space-between",
      }}>
        <div>
          <div style={{
            fontSize: 22, fontWeight: 500, letterSpacing: "0.25em",
            textTransform: "uppercase", color: "#7A2E4A",
          }}>
            Why this one matters
          </div>
          <div style={{
            fontFamily: "Cormorant, serif", fontWeight: 400, fontSize: 56,
            lineHeight: 1.15, letterSpacing: "-0.01em",
            color: "#2A2320", marginTop: 28,
          }}>
            {l.trim || "A collector example"}.
          </div>
          <div style={{
            fontSize: 24, lineHeight: 1.55, color: "#4a4038", marginTop: 32,
          }}>
            {data.thesis}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {facts.map((f, i) => (
            <div key={i} style={{
              fontSize: 22, color: "#2A2320", paddingLeft: 28, position: "relative",
            }}>
              <span style={{ position: "absolute", left: 0, color: "#7A2E4A", fontWeight: 500 }}>—</span>
              {f}
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
```

- [ ] **Step 3: Implement Slide5CTA**

Replace `producto/src/features/social-engine/templates/CarouselV1/Slide5CTA.tsx` with:

```typescript
import { SlideFrame } from "./SlideFrame";
import { pickPhoto, type SlideData } from "./templateData";

export function Slide5CTA({ data }: { data: SlideData }) {
  const photo = pickPhoto(data, 3);

  return (
    <SlideFrame theme="dark">
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `url(${photo})`, backgroundSize: "cover", backgroundPosition: "center",
        opacity: 0.45,
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at center, rgba(14,10,12,0.3) 0%, rgba(14,10,12,0.92) 100%)",
      }} />
      <div style={{
        position: "relative", height: "100%", display: "flex",
        alignItems: "center", justifyContent: "center", textAlign: "center",
      }}>
        <div>
          <div style={{
            fontSize: 22, fontWeight: 500, letterSpacing: "0.3em",
            textTransform: "uppercase", color: "#D4738A",
          }}>
            Visítanos
          </div>
          <div style={{
            fontFamily: "Cormorant, serif", fontWeight: 300, fontSize: 116,
            letterSpacing: "-0.02em", color: "#E8E2DE", marginTop: 48, lineHeight: 1.05,
          }}>
            Full report on<br/>MonzaHaus
          </div>
          <div style={{
            fontFamily: "Geist Mono, monospace", fontSize: 28,
            color: "#D4738A", marginTop: 48, letterSpacing: "0.05em",
          }}>
            monzahaus.com
          </div>
        </div>
      </div>
      <div style={{
        position: "absolute", bottom: 72, left: "50%", transform: "translateX(-50%)",
        fontFamily: "Cormorant, serif", fontWeight: 600, fontSize: 64,
        color: "#E8E2DE", letterSpacing: "-0.04em",
      }}>
        M
      </div>
    </SlideFrame>
  );
}
```

- [ ] **Step 4: Manually verify slides in browser**

Start dev server: `cd producto && npm run dev`
Find a real draft ID (or seed one by running `npx tsx scripts/social-engine-worker.ts`).
Visit each: `http://localhost:3000/internal/carousel/{draftId}/1` through `/5`.
Expected: Each slide renders at 1080×1350 with real data and photos.

If fonts look wrong, Google Fonts may not have loaded in time. Test is visual only at this stage.

- [ ] **Step 5: Commit**

```bash
git add producto/src/features/social-engine/templates/CarouselV1/Slide3Market.tsx producto/src/features/social-engine/templates/CarouselV1/Slide4Story.tsx producto/src/features/social-engine/templates/CarouselV1/Slide5CTA.tsx
git commit -m "feat(social-engine): implement Slide 3 (market) + Slide 4 (story) + Slide 5 (CTA)"
```

---

## Task 10: Carousel renderer + Storage uploader

**Files:**
- Create: `producto/src/features/social-engine/services/storageUploader.ts`
- Create: `producto/src/features/social-engine/services/carouselRenderer.ts`

- [ ] **Step 1: Implement storage uploader**

Create `producto/src/features/social-engine/services/storageUploader.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const BUCKET = "social-carousels";

function makeClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function uploadSlidePng(draftId: string, slideIdx: number, png: Buffer): Promise<string> {
  const supa = makeClient();
  const path = `${draftId}/slide-${slideIdx}.png`;
  const { error } = await supa.storage.from(BUCKET).upload(path, png, {
    contentType: "image/png",
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw error;
  const { data } = supa.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
```

- [ ] **Step 2: Implement carousel renderer**

Create `producto/src/features/social-engine/services/carouselRenderer.ts`:

```typescript
import chromium from "@sparticuz/chromium";
import { chromium as pw } from "playwright-core";
import { CAROUSEL } from "../config";
import { uploadSlidePng } from "./storageUploader";

async function launchBrowser() {
  const executablePath = process.env.CHROMIUM_PATH ?? (await chromium.executablePath());
  const headlessArgs = chromium.args;
  const browser = await pw.launch({
    executablePath,
    args: headlessArgs,
    headless: true,
  });
  return browser;
}

export async function renderCarousel(draftId: string, baseUrl: string): Promise<string[]> {
  const browser = await launchBrowser();
  try {
    const urls: string[] = [];
    for (let i = 1; i <= CAROUSEL.slideCount; i++) {
      const context = await browser.newContext({
        viewport: { width: CAROUSEL.width, height: CAROUSEL.height },
        deviceScaleFactor: CAROUSEL.deviceScaleFactor,
      });
      const page = await context.newPage();
      const target = `${baseUrl}/internal/carousel/${draftId}/${i}`;
      await page.goto(target, { waitUntil: "networkidle", timeout: 30_000 });
      // Wait for Google Fonts (Cormorant + Karla) to load via document.fonts API
      await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<void> } }).fonts.ready);
      // Small settle delay so images finish decoding
      await page.waitForTimeout(500);

      const png = await page.screenshot({
        type: "png",
        fullPage: false,
        clip: { x: 0, y: 0, width: CAROUSEL.width, height: CAROUSEL.height },
      });
      const url = await uploadSlidePng(draftId, i, png);
      urls.push(url);
      await context.close();
    }
    return urls;
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | grep social-engine | head -10`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add producto/src/features/social-engine/services/storageUploader.ts producto/src/features/social-engine/services/carouselRenderer.ts
git commit -m "feat(social-engine): add Puppeteer carousel renderer + Supabase Storage uploader"
```

---

## Task 11: Generate API endpoint

**Files:**
- Create: `producto/src/app/api/social/generate/[draftId]/route.ts`

- [ ] **Step 1: Implement route**

Create `producto/src/app/api/social/generate/[draftId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { DraftRepository } from "@/features/social-engine/repository/draftRepository";
import { renderCarousel } from "@/features/social-engine/services/carouselRenderer";
import { generateCaption } from "@/features/social-engine/services/captionGenerator";
import { fetchComparablesSummary } from "@/features/social-engine/services/comparablesService";
import { filterRealPhotoUrls } from "@/features/social-engine/services/photoValidator";
import { createClient } from "@supabase/supabase-js";
import { extractSeries, getSeriesThesis } from "@/lib/brandConfig";
import type { ListingRow } from "@/features/social-engine/types";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min

function assertAdmin(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  if (!token || token !== process.env.ADMIN_DASHBOARD_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ draftId: string }> }) {
  const authFail = assertAdmin(req);
  if (authFail) return authFail;

  const { draftId } = await ctx.params;
  const repo = new DraftRepository();
  const draft = await repo.findById(draftId);
  if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    await repo.updateStatus(draftId, "generating");

    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data: listing } = await supa.from("listings").select("*").eq("id", draft.listing_id).single();
    if (!listing) {
      await repo.appendError(draftId, { at: new Date().toISOString(), component: "generator", message: "listing not found" });
      return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
    }

    const typed = listing as ListingRow;
    const photos = filterRealPhotoUrls(typed.images ?? []);
    if (photos.length < 4) {
      const msg = `not enough valid photos: ${photos.length}`;
      await repo.appendError(draftId, { at: new Date().toISOString(), component: "generator", message: msg });
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    const comps = await fetchComparablesSummary(typed).catch(() => null);

    let thesis = "A collector-grade example worth close examination.";
    if (typed.make === "Porsche" && typed.model && typed.year) {
      const series = extractSeries(typed.model, typed.year, typed.make);
      if (series) thesis = getSeriesThesis(series, typed.make) ?? thesis;
    }

    const caption = await generateCaption(typed, comps, thesis);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `http://localhost:3000`;
    const slideUrls = await renderCarousel(draftId, baseUrl);

    await repo.updateGeneration(draftId, slideUrls, caption.caption, caption.hashtags);

    return NextResponse.json({ ok: true, slideUrls, caption });
  } catch (err) {
    const message = (err as Error).message;
    await repo.appendError(draftId, {
      at: new Date().toISOString(),
      component: "generator", message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Test manually**

Start dev server: `cd producto && npm run dev`
With a real draft ID from DB (or seed via worker):
```bash
curl -X POST -H "x-admin-token: YOUR_TOKEN" http://localhost:3000/api/social/generate/<draftId>
```
Expected: 200 response with `{ ok: true, slideUrls: [...], caption: {...} }` after ~60-90s. Supabase Storage should contain 5 PNGs.

- [ ] **Step 3: Commit**

```bash
git add producto/src/app/api/social/generate
git commit -m "feat(social-engine): add generate endpoint with auth gate"
```

---

## Task 12: Admin dashboard — list view

**Files:**
- Create: `producto/src/app/[locale]/admin/social/middleware.ts`
- Create: `producto/src/app/[locale]/admin/social/page.tsx`

- [ ] **Step 1: Create middleware**

Note: Next.js App Router middleware lives at `src/middleware.ts` (one root middleware). Since the main middleware handles i18n, we can't add another at the admin route level. Instead, check the token in the page itself using a server guard helper.

Create `producto/src/features/social-engine/auth.ts`:

```typescript
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function requireAdmin() {
  const expected = process.env.ADMIN_DASHBOARD_TOKEN;
  if (!expected) {
    // Fail safe: don't expose dashboard if unconfigured
    redirect("/");
  }
  const store = await cookies();
  const got = store.get("admin_token")?.value;
  if (got !== expected) {
    redirect("/admin/social/login");
  }
}
```

- [ ] **Step 2: Create login route**

Create `producto/src/app/[locale]/admin/social/login/page.tsx`:

```typescript
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function submit(formData: FormData) {
  "use server";
  const token = formData.get("token")?.toString() ?? "";
  if (token !== process.env.ADMIN_DASHBOARD_TOKEN) {
    redirect("/admin/social/login?error=1");
  }
  const store = await cookies();
  store.set("admin_token", token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/admin",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/admin/social");
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0E0A0C", color: "#E8E2DE", fontFamily: "Karla, sans-serif",
    }}>
      <form action={submit} style={{ display: "flex", flexDirection: "column", gap: 16, width: 320 }}>
        <h1 style={{ fontFamily: "Cormorant, serif", fontWeight: 400, fontSize: 32 }}>MonzaHaus Admin</h1>
        <input type="password" name="token" placeholder="Admin token" required
          style={{ padding: "12px 16px", background: "#161113", border: "1px solid #2A2226", color: "#E8E2DE", borderRadius: 6 }} />
        <button type="submit" style={{ padding: "12px 16px", background: "#7A2E4A", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}>
          Enter
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create list page**

Create `producto/src/app/[locale]/admin/social/page.tsx`:

```typescript
import { requireAdmin } from "@/features/social-engine/auth";
import { DraftRepository } from "@/features/social-engine/repository/draftRepository";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { DraftStatus, SocialPostDraft } from "@/features/social-engine/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TABS: { key: DraftStatus; label: string }[] = [
  { key: "pending_review", label: "Pending" },
  { key: "ready", label: "Ready" },
  { key: "published", label: "Published" },
  { key: "discarded", label: "Discarded" },
  { key: "failed", label: "Failed" },
];

async function fetchListingHeaders(ids: string[]) {
  if (ids.length === 0) return new Map();
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data } = await supa.from("listings")
    .select("id, title, year, make, model, trim, platform, images")
    .in("id", ids);
  return new Map((data ?? []).map((l) => [l.id, l]));
}

function DraftCard({ draft, listing }: { draft: SocialPostDraft; listing: { id: string; title: string | null; platform: string | null; images: string[] | null } | undefined }) {
  const cover = Array.isArray(listing?.images)
    ? listing!.images.find((u) => typeof u === "string" && u.startsWith("http") && !u.includes("/assets/"))
    : null;
  return (
    <Link href={`/admin/social/${draft.id}`} style={{
      display: "flex", gap: 16, padding: 16, background: "#161113",
      border: "1px solid #2A2226", borderRadius: 10, textDecoration: "none", color: "#E8E2DE",
    }}>
      <div style={{
        width: 120, height: 150,
        backgroundImage: cover ? `url(${cover})` : "none",
        backgroundColor: "#0E0A0C",
        backgroundSize: "cover", backgroundPosition: "center", borderRadius: 6, flexShrink: 0,
      }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "Cormorant, serif", fontWeight: 400, fontSize: 22, lineHeight: 1.2 }}>
            {listing?.title ?? "Unknown listing"}
          </div>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#9A8E88", marginTop: 4 }}>
            {listing?.platform?.replace(/_/g, " ").toLowerCase()}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#9A8E88" }}>
          <span>Quality: {draft.quality_score}</span>
          <span>Vision: {draft.vision_score}</span>
          <span>Status: {draft.status}</span>
        </div>
      </div>
    </Link>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: DraftStatus }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab: DraftStatus = (sp.tab as DraftStatus) ?? "pending_review";

  const repo = new DraftRepository();
  const drafts = await repo.listByStatus(tab, 50);
  const listings = await fetchListingHeaders(drafts.map((d) => d.listing_id));

  return (
    <div style={{
      minHeight: "100vh", background: "#0E0A0C", color: "#E8E2DE", padding: "48px 64px",
      fontFamily: "Karla, sans-serif",
    }}>
      <h1 style={{ fontFamily: "Cormorant, serif", fontWeight: 400, fontSize: 44, marginBottom: 32 }}>
        Social Engine · Drafts
      </h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        {TABS.map((t) => (
          <Link key={t.key} href={`?tab=${t.key}`} style={{
            padding: "8px 16px", borderRadius: 20, textDecoration: "none",
            background: tab === t.key ? "#7A2E4A" : "transparent",
            border: "1px solid " + (tab === t.key ? "#7A2E4A" : "#2A2226"),
            color: tab === t.key ? "white" : "#9A8E88",
            fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase",
          }}>
            {t.label}
          </Link>
        ))}
      </div>
      {drafts.length === 0 ? (
        <div style={{ color: "#9A8E88", fontSize: 14 }}>No drafts in this state.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 16 }}>
          {drafts.map((d) => <DraftCard key={d.id} draft={d} listing={listings.get(d.listing_id)} />)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Test**

Start dev server, set cookie via login (`/admin/social/login` with your token), navigate to `/admin/social`. Expected: list of drafts with cards and tab filtering.

- [ ] **Step 5: Commit**

```bash
git add producto/src/features/social-engine/auth.ts producto/src/app/[locale]/admin/social/page.tsx producto/src/app/[locale]/admin/social/login
git commit -m "feat(social-engine): add admin dashboard list + cookie auth gate"
```

---

## Task 13: Admin dashboard — detail view

**Files:**
- Create: `producto/src/app/[locale]/admin/social/[draftId]/page.tsx`
- Create: `producto/src/app/[locale]/admin/social/[draftId]/actions.ts`
- Create: `producto/src/app/[locale]/admin/social/[draftId]/DraftEditor.tsx`

- [ ] **Step 1: Create server actions**

Create `producto/src/app/[locale]/admin/social/[draftId]/actions.ts`:

```typescript
"use server";

import { DraftRepository } from "@/features/social-engine/repository/draftRepository";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

async function assertAdmin() {
  const store = await cookies();
  if (store.get("admin_token")?.value !== process.env.ADMIN_DASHBOARD_TOKEN) {
    throw new Error("unauthorized");
  }
}

export async function triggerGenerate(draftId: string) {
  await assertAdmin();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const r = await fetch(`${baseUrl}/api/social/generate/${draftId}`, {
    method: "POST",
    headers: { "x-admin-token": process.env.ADMIN_DASHBOARD_TOKEN! },
  });
  if (!r.ok) {
    throw new Error(`generate failed: ${await r.text()}`);
  }
  revalidatePath(`/admin/social/${draftId}`);
}

export async function triggerPublish(draftId: string, captionFinal: string) {
  await assertAdmin();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const r = await fetch(`${baseUrl}/api/social/publish/${draftId}`, {
    method: "POST",
    headers: {
      "x-admin-token": process.env.ADMIN_DASHBOARD_TOKEN!,
      "content-type": "application/json",
    },
    body: JSON.stringify({ caption_final: captionFinal }),
  });
  if (!r.ok) {
    throw new Error(`publish failed: ${await r.text()}`);
  }
  revalidatePath(`/admin/social/${draftId}`);
  revalidatePath(`/admin/social`);
}

export async function discardDraft(draftId: string, reason: string) {
  await assertAdmin();
  const repo = new DraftRepository();
  await repo.discard(draftId, reason || "manually discarded");
  revalidatePath(`/admin/social`);
}
```

- [ ] **Step 2: Create editor client component**

Create `producto/src/app/[locale]/admin/social/[draftId]/DraftEditor.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { triggerGenerate, triggerPublish, discardDraft } from "./actions";
import type { SocialPostDraft } from "@/features/social-engine/types";

export function DraftEditor({ draft }: { draft: SocialPostDraft }) {
  const [caption, setCaption] = useState(draft.caption_final ?? draft.caption_draft ?? "");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const slides = draft.generated_slide_urls ?? [];

  const run = (fn: () => Promise<void>) => startTransition(async () => {
    setMessage(null);
    try { await fn(); setMessage("OK"); }
    catch (e) { setMessage("Error: " + (e as Error).message); }
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {slides.length === 0 ? (
        <div style={{
          padding: 32, background: "#161113", border: "1px dashed #2A2226", borderRadius: 10,
          textAlign: "center", color: "#9A8E88",
        }}>
          <div style={{ marginBottom: 16 }}>Slides not generated yet.</div>
          <button
            disabled={isPending}
            onClick={() => run(() => triggerGenerate(draft.id))}
            style={{ padding: "12px 24px", background: "#7A2E4A", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}
          >
            {isPending ? "Generating..." : "Generate carousel"}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 16, overflowX: "auto" }}>
          {slides.map((url, i) => (
            <div key={i} style={{ flex: "0 0 auto" }}>
              <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#9A8E88", textAlign: "center", marginBottom: 6 }}>
                Slide {i + 1}
              </div>
              <img src={url} alt={`Slide ${i + 1}`}
                style={{ width: 432, height: 540, objectFit: "cover", borderRadius: 6 }} />
            </div>
          ))}
        </div>
      )}

      <div>
        <div style={{ fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: "#9A8E88", marginBottom: 12 }}>
          Caption
        </div>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={6}
          style={{
            width: "100%", padding: 16, background: "#161113", border: "1px solid #2A2226",
            color: "#E8E2DE", borderRadius: 6, fontFamily: "Karla, sans-serif", fontSize: 14, lineHeight: 1.6,
          }}
        />
        {draft.hashtags && draft.hashtags.length > 0 && (
          <div style={{ marginTop: 8, fontFamily: "Geist Mono, monospace", fontSize: 12, color: "#9A8E88" }}>
            {draft.hashtags.map((h) => `#${h}`).join(" · ")}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          disabled={isPending || slides.length === 0 || !caption.trim()}
          onClick={() => run(() => triggerPublish(draft.id, caption))}
          style={{ padding: "12px 24px", background: "#34D399", color: "#0E0A0C", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}
        >
          {isPending ? "Publishing..." : "Publish to IG + FB"}
        </button>
        <button
          disabled={isPending || slides.length === 0}
          onClick={() => run(() => triggerGenerate(draft.id))}
          style={{ padding: "12px 24px", background: "transparent", color: "#E8E2DE", border: "1px solid #2A2226", borderRadius: 6, cursor: "pointer" }}
        >
          Regenerate
        </button>
        <button
          disabled={isPending}
          onClick={() => {
            if (!confirm("Discard this draft?")) return;
            run(() => discardDraft(draft.id, "manual"));
          }}
          style={{ padding: "12px 24px", background: "transparent", color: "#FB923C", border: "1px solid #FB923C", borderRadius: 6, cursor: "pointer" }}
        >
          Discard
        </button>
      </div>

      {message && (
        <div style={{ padding: 12, background: "#161113", border: "1px solid #2A2226", borderRadius: 6, fontSize: 12, color: "#9A8E88" }}>
          {message}
        </div>
      )}

      <div style={{ fontSize: 11, color: "#9A8E88", marginTop: 16 }}>
        <div>Quality: {draft.quality_score} · Vision: {draft.vision_score}</div>
        <div style={{ marginTop: 4 }}>{draft.vision_notes}</div>
        {draft.error_log && draft.error_log.length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer", color: "#FB923C" }}>Errors</summary>
            <pre style={{ fontSize: 10, whiteSpace: "pre-wrap", color: "#FB923C" }}>{JSON.stringify(draft.error_log, null, 2)}</pre>
          </details>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create detail page**

Create `producto/src/app/[locale]/admin/social/[draftId]/page.tsx`:

```typescript
import { requireAdmin } from "@/features/social-engine/auth";
import { DraftRepository } from "@/features/social-engine/repository/draftRepository";
import { DraftEditor } from "./DraftEditor";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Page({ params }: { params: Promise<{ draftId: string; locale: string }> }) {
  await requireAdmin();
  const { draftId, locale } = await params;
  const repo = new DraftRepository();
  const draft = await repo.findById(draftId);
  if (!draft) notFound();

  return (
    <div style={{
      minHeight: "100vh", background: "#0E0A0C", color: "#E8E2DE", padding: "48px 64px",
      fontFamily: "Karla, sans-serif",
    }}>
      <Link href={`/${locale}/admin/social`} style={{ color: "#9A8E88", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", textDecoration: "none" }}>
        ← Back to drafts
      </Link>
      <h1 style={{ fontFamily: "Cormorant, serif", fontWeight: 400, fontSize: 40, margin: "16px 0 32px" }}>
        Draft {draftId.slice(0, 8)}
      </h1>
      <DraftEditor draft={draft} />
    </div>
  );
}
```

- [ ] **Step 4: Test manually**

Navigate to `/admin/social/{realDraftId}`.
Click `Generate carousel`, wait ~60s, verify slides appear.
Edit caption, click Publish (this will fail until Task 14 — that's expected).
Click Discard, verify the draft moves to `discarded` tab.

- [ ] **Step 5: Commit**

```bash
git add producto/src/app/[locale]/admin/social/[draftId]
git commit -m "feat(social-engine): add admin draft detail editor"
```

---

## Task 14: Meta publisher

**Files:**
- Create: `producto/src/features/social-engine/services/metaPublisher.ts`
- Create: `producto/src/features/social-engine/services/metaPublisher.test.ts`
- Create: `producto/src/app/api/social/publish/[draftId]/route.ts`

- [ ] **Step 1: Write failing test**

Create `producto/src/features/social-engine/services/metaPublisher.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishToMeta, MetaPublishError } from "./metaPublisher";

const originalFetch = global.fetch;
beforeEach(() => { global.fetch = originalFetch; vi.restoreAllMocks(); });

describe("publishToMeta", () => {
  it("sequences IG containers then publish, plus FB post", async () => {
    const calls: { url: string; body?: unknown }[] = [];
    global.fetch = vi.fn(async (input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ url, body });

      // IG image container responses (5x)
      if (url.includes("/media") && body?.is_carousel_item) {
        return new Response(JSON.stringify({ id: "item-" + calls.length }), { status: 200 });
      }
      // IG carousel container
      if (url.includes("/media") && body?.media_type === "CAROUSEL") {
        return new Response(JSON.stringify({ id: "carousel-1" }), { status: 200 });
      }
      // IG publish
      if (url.includes("/media_publish")) {
        return new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 });
      }
      // FB photos
      if (url.includes("/photos")) {
        return new Response(JSON.stringify({ id: "fb-photo-" + calls.length }), { status: 200 });
      }
      // FB feed
      if (url.includes("/feed")) {
        return new Response(JSON.stringify({ id: "fb-post-1" }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected" }), { status: 500 });
    }) as unknown as typeof fetch;

    const res = await publishToMeta({
      pageId: "PAGE", igBusinessId: "IG", pageAccessToken: "TOK", apiVersion: "v19.0",
      slideUrls: ["a.png", "b.png", "c.png", "d.png", "e.png"],
      caption: "test caption",
      reportUrl: "https://monzahaus.com/x",
    });

    expect(res.ig_post_id).toBe("ig-post-1");
    expect(res.fb_post_id).toBe("fb-post-1");
    expect(res.ig_creation_id).toBe("carousel-1");
    expect(calls.length).toBeGreaterThanOrEqual(7); // 5 IG containers + carousel + publish + FB
  });

  it("throws MetaPublishError on IG container failure", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ error: { message: "nope" } }), { status: 400 })) as unknown as typeof fetch;
    await expect(publishToMeta({
      pageId: "P", igBusinessId: "I", pageAccessToken: "T", apiVersion: "v19.0",
      slideUrls: ["a.png", "b.png", "c.png", "d.png", "e.png"],
      caption: "x", reportUrl: "https://x.com",
    })).rejects.toBeInstanceOf(MetaPublishError);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

Run: `npx vitest run src/features/social-engine/services/metaPublisher.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement meta publisher**

Create `producto/src/features/social-engine/services/metaPublisher.ts`:

```typescript
export class MetaPublishError extends Error {
  constructor(public stage: string, public status: number, public body: unknown) {
    super(`Meta publish failed at ${stage}: ${JSON.stringify(body)}`);
  }
}

export interface PublishConfig {
  pageId: string;
  igBusinessId: string;
  pageAccessToken: string;
  apiVersion: string; // e.g. "v19.0"
  slideUrls: string[]; // 5 public PNG URLs (must be HTTPS and publicly fetchable by Meta)
  caption: string;
  reportUrl: string;
}

export interface PublishResult {
  ig_post_id: string;
  fb_post_id: string;
  ig_creation_id: string;
}

async function metaFetch(url: string, body: Record<string, unknown>, stage: string) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new MetaPublishError(stage, r.status, data);
  return data as { id: string };
}

export async function publishToInstagram(cfg: PublishConfig): Promise<{ ig_post_id: string; ig_creation_id: string }> {
  const base = `https://graph.facebook.com/${cfg.apiVersion}`;

  // 1. Create container for each image (is_carousel_item=true)
  const containerIds: string[] = [];
  for (const imageUrl of cfg.slideUrls) {
    const item = await metaFetch(`${base}/${cfg.igBusinessId}/media`, {
      image_url: imageUrl,
      is_carousel_item: true,
      access_token: cfg.pageAccessToken,
    }, "ig_carousel_item");
    containerIds.push(item.id);
  }

  // 2. Create carousel container
  const carousel = await metaFetch(`${base}/${cfg.igBusinessId}/media`, {
    media_type: "CAROUSEL",
    children: containerIds.join(","),
    caption: cfg.caption,
    access_token: cfg.pageAccessToken,
  }, "ig_carousel_container");

  // 3. Publish carousel
  const published = await metaFetch(`${base}/${cfg.igBusinessId}/media_publish`, {
    creation_id: carousel.id,
    access_token: cfg.pageAccessToken,
  }, "ig_publish");

  return { ig_post_id: published.id, ig_creation_id: carousel.id };
}

export async function publishToFacebookPage(cfg: PublishConfig): Promise<{ fb_post_id: string }> {
  const base = `https://graph.facebook.com/${cfg.apiVersion}`;

  // 1. Upload each photo as unpublished
  const photoIds: string[] = [];
  for (const imageUrl of cfg.slideUrls) {
    const p = await metaFetch(`${base}/${cfg.pageId}/photos`, {
      url: imageUrl,
      published: false,
      access_token: cfg.pageAccessToken,
    }, "fb_photo");
    photoIds.push(p.id);
  }

  // 2. Create feed post with attached media
  const post = await metaFetch(`${base}/${cfg.pageId}/feed`, {
    message: cfg.caption + "\n\n" + cfg.reportUrl,
    attached_media: JSON.stringify(photoIds.map((id) => ({ media_fbid: id }))),
    access_token: cfg.pageAccessToken,
  }, "fb_feed");

  return { fb_post_id: post.id };
}

export async function publishToMeta(cfg: PublishConfig): Promise<PublishResult> {
  const ig = await publishToInstagram(cfg);
  const fb = await publishToFacebookPage(cfg);
  return { ig_post_id: ig.ig_post_id, ig_creation_id: ig.ig_creation_id, fb_post_id: fb.fb_post_id };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/social-engine/services/metaPublisher.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Create publish route**

Create `producto/src/app/api/social/publish/[draftId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { DraftRepository } from "@/features/social-engine/repository/draftRepository";
import { publishToMeta } from "@/features/social-engine/services/metaPublisher";
import { createClient } from "@supabase/supabase-js";
import { buildReportUrl } from "@/features/social-engine/services/captionGenerator";
import type { ListingRow } from "@/features/social-engine/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function assertAdmin(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  if (!token || token !== process.env.ADMIN_DASHBOARD_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ draftId: string }> }) {
  const authFail = assertAdmin(req);
  if (authFail) return authFail;

  const { draftId } = await ctx.params;
  const { caption_final } = (await req.json().catch(() => ({}))) as { caption_final?: string };

  const repo = new DraftRepository();
  const draft = await repo.findById(draftId);
  if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!draft.generated_slide_urls || draft.generated_slide_urls.length !== 5) {
    return NextResponse.json({ error: "carousel not ready" }, { status: 422 });
  }
  const caption = caption_final ?? draft.caption_final ?? draft.caption_draft ?? "";
  if (!caption.trim()) return NextResponse.json({ error: "caption is empty" }, { status: 422 });

  const required = ["META_PAGE_ACCESS_TOKEN", "META_PAGE_ID", "META_IG_BUSINESS_ID"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    await repo.appendError(draftId, {
      at: new Date().toISOString(), component: "publisher",
      message: `missing env: ${missing.join(", ")}`,
    });
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }

  try {
    await repo.updateStatus(draftId, "publishing");

    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data: listing } = await supa.from("listings").select("*").eq("id", draft.listing_id).single();
    const reportUrl = `https://${buildReportUrl(listing as ListingRow)}`;

    const out = await publishToMeta({
      pageId: process.env.META_PAGE_ID!,
      igBusinessId: process.env.META_IG_BUSINESS_ID!,
      pageAccessToken: process.env.META_PAGE_ACCESS_TOKEN!,
      apiVersion: process.env.META_GRAPH_API_VERSION ?? "v19.0",
      slideUrls: draft.generated_slide_urls,
      caption,
      reportUrl,
    });

    await repo.updatePublished(draftId, out.ig_post_id, out.fb_post_id, out.ig_creation_id, caption);
    return NextResponse.json({ ok: true, ...out });
  } catch (err) {
    const message = (err as Error).message;
    await repo.appendError(draftId, {
      at: new Date().toISOString(), component: "publisher", message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add producto/src/features/social-engine/services/metaPublisher.ts producto/src/features/social-engine/services/metaPublisher.test.ts producto/src/app/api/social/publish
git commit -m "feat(social-engine): add Meta Graph API publisher + publish endpoint"
```

---

## Task 15: Vercel Cron integration

**Files:**
- Create: `producto/src/app/api/cron/social-engine/route.ts`
- Modify: `producto/vercel.json`

- [ ] **Step 1: Create cron route**

Create `producto/src/app/api/cron/social-engine/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { runWorker } from "@/features/social-engine/workers/worker";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // Vercel Cron sends Authorization: Bearer ${CRON_SECRET} automatically if configured.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const result = await runWorker();
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Add cron entry to vercel.json**

Modify `producto/vercel.json`. Find the `crons` array and append:

```json
{ "path": "/api/cron/social-engine", "schedule": "0 9 * * *" }
```

Full context of the change (insert before the closing `]`):

```json
  "crons": [
    { "path": "/api/cron/ferrari",      "schedule": "0 0 * * *" },
    ... existing entries ...
    { "path": "/api/cron/enrich-elferspot", "schedule": "45 9 * * *" },
    { "path": "/api/cron/social-engine",    "schedule": "0 9 * * *" }
  ]
```

- [ ] **Step 3: Test locally**

With env vars set:
```bash
curl http://localhost:3000/api/cron/social-engine
```
Expected: 200 with worker result JSON.

With `CRON_SECRET` set, verify unauthorized request returns 401:
```bash
curl http://localhost:3000/api/cron/social-engine -H "authorization: Bearer wrong"
```
Expected: 401.

- [ ] **Step 4: Commit**

```bash
git add producto/src/app/api/cron/social-engine producto/vercel.json
git commit -m "feat(social-engine): wire Vercel Cron entry for daily worker run"
```

---

## Task 16: End-to-end smoke test + Meta setup docs

**Files:**
- Create: `producto/src/features/social-engine/workers/worker.smoke.test.ts`
- Create: `producto/docs/social-engine-setup.md`

- [ ] **Step 1: Write smoke test**

Create `producto/src/features/social-engine/workers/worker.smoke.test.ts`:

```typescript
/**
 * Smoke test — runs the full worker flow against real Supabase (read-only; does not create drafts).
 * Skips in CI without real env vars. Meant for manual verification during development.
 *
 *   SOCIAL_ENGINE_SMOKE=1 npx vitest run src/features/social-engine/workers/worker.smoke.test.ts
 */
import { describe, it, expect } from "vitest";
import { fetchGate1Candidates } from "../services/listingSelector";
import { filterRealPhotoUrls } from "../services/photoValidator";

const SHOULD_RUN = process.env.SOCIAL_ENGINE_SMOKE === "1";

describe.skipIf(!SHOULD_RUN)("social-engine worker smoke", () => {
  it("can fetch Gate 1 candidates from real DB", async () => {
    const rows = await fetchGate1Candidates();
    console.log(`Found ${rows.length} candidates`);
    for (const r of rows.slice(0, 3)) {
      const real = filterRealPhotoUrls(r.images ?? []);
      console.log(`  ${r.platform} ${r.year} ${r.model} ${r.trim}: ${real.length} real photos`);
    }
    // Not strict — zero candidates is valid when nothing new was scraped in 7 days.
    expect(rows.length).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Create Meta setup doc**

Create `producto/docs/social-engine-setup.md`:

```markdown
# Social Engine — One-Time Setup Guide

Complete these steps before enabling the Vercel Cron entry for `/api/cron/social-engine`.

## 1. Supabase Storage bucket

Supabase dashboard → Storage → New bucket:
- Name: `social-carousels`
- Public: **Yes** (read)
- File size limit: 10 MB

Bucket policies (add via SQL editor):

```sql
-- Allow service role writes, public reads
create policy "Service role writes" on storage.objects
  for all using (bucket_id = 'social-carousels' and auth.role() = 'service_role');
create policy "Public read" on storage.objects
  for select using (bucket_id = 'social-carousels');
```

## 2. Meta Business Setup

### Required accounts
- Meta Business Manager account
- A Facebook Page under that Business Manager
- An Instagram **Business** account (not Personal, not Creator). Convert via Instagram app → Settings → Account type → Switch to Professional → Business.
- Instagram account linked to the Page: Facebook Page → Settings → Linked accounts → Instagram → Connect.

### Create Meta App
1. Go to https://developers.facebook.com/apps → Create App
2. App type: **Business**
3. Add these products to the app:
   - **Facebook Login for Business**
   - **Instagram Graph API**
4. In App Review → Permissions and Features, request (or use in dev mode):
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `instagram_basic`
   - `instagram_content_publish`

### Obtain Page Access Token
1. Tools → Graph API Explorer
2. Select your app and user token with the above permissions
3. GET `/me/accounts` → find your Page and copy its `access_token`
4. That's a short-lived token. Convert to long-lived (60 days):
   ```
   curl "https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={SHORT_TOKEN}"
   ```
5. That long-lived token is what goes in `META_PAGE_ACCESS_TOKEN`.

### Get IG Business ID
```
curl "https://graph.facebook.com/v19.0/{PAGE_ID}?fields=instagram_business_account&access_token={TOKEN}"
```
Returns `{ "instagram_business_account": { "id": "17841..." } }` — copy that ID into `META_IG_BUSINESS_ID`.

## 3. Environment variables

Add to Vercel (Settings → Environment Variables) and to `.env.local`:

```
META_PAGE_ACCESS_TOKEN=<long-lived token from step 2>
META_PAGE_ID=<numeric Page ID>
META_IG_BUSINESS_ID=<numeric IG Business Account ID>
META_GRAPH_API_VERSION=v19.0
ADMIN_DASHBOARD_TOKEN=<openssl rand -hex 32>
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
CRON_SECRET=<openssl rand -hex 32>  # optional; Vercel can auto-provide
```

Existing vars expected to already be present:
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY` (or `GEMINI_API_KEY`)

## 4. Token refresh — manual for v1

Meta long-lived Page tokens last **~60 days**. Vercel logs will not auto-alert. Put a calendar reminder to refresh every 50 days. To refresh, re-run the long-lived exchange from step 2.

## 5. First run

1. Deploy to production.
2. Trigger the worker manually once to seed a draft:
   ```
   curl "https://yourdomain.com/api/cron/social-engine" -H "authorization: Bearer $CRON_SECRET"
   ```
3. Visit `https://yourdomain.com/admin/social/login`, enter your admin token.
4. Open a draft, click Generate, then Publish. Verify the post appears on IG + FB.

## 6. Troubleshooting

- **"Invalid image URL"** from Meta → the slide URL must be **publicly reachable over HTTPS**. Supabase Storage public bucket is fine; private bucket is not.
- **IG publish "duplicate media"** → Meta deduplicates within a short window. Regenerate slides to get new URLs, then republish.
- **Vision score always low** → check that the first 3 `images[]` entries are real photo URLs. AS24 listings can have placeholder `/assets/` entries at index 1.
```

- [ ] **Step 3: Self-review the plan**

Read through this plan one more time. Verify each task compiles independently and the naming is consistent (draft IDs, function names, env vars).

- [ ] **Step 4: Commit**

```bash
git add producto/src/features/social-engine/workers/worker.smoke.test.ts producto/docs/social-engine-setup.md
git commit -m "docs(social-engine): add setup guide + smoke test"
```

---

## Post-implementation checklist

Verify before declaring done:

- [ ] Migration applied in Supabase (table exists, indexes exist)
- [ ] Supabase Storage bucket `social-carousels` created with policies
- [ ] All environment variables set in Vercel
- [ ] Meta setup completed per `docs/social-engine-setup.md`
- [ ] Worker CLI runs locally without error: `npx tsx scripts/social-engine-worker.ts`
- [ ] Vision + caption generation works on at least one real listing
- [ ] Admin dashboard login works
- [ ] Full publish cycle tested once (end up with a real IG + FB post)
- [ ] Cron entry `0 9 * * *` active in `vercel.json` and visible in Vercel Cron dashboard

## Open items for v2 (not in scope now)

- Automated Meta token refresh (currently manual every 50 days)
- Classic.com source re-enable (needs full-res CDN params)
- Reels generation
- Multi-language (ES parallel account)
- Rotating `/latest` landing page

---

*End of plan.*
