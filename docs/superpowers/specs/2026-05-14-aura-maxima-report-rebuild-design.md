# Aura Maxima — Report Experience Rebuild

**Status:** Approved design — ready for implementation plan
**Branch:** `Aura-Maxima-Front`
**Date:** 2026-05-14
**Author:** Edgar Navarro (with Claude)
**Origin:** Meeting with Camilo Echeverri, 2026-05-14 ("wbi-bpka-jdu", Fireflies `01KRMA2Y1JG4DAFTYT42WTTSWZ`)

---

## 1. Context & motivation

The paid Haus Report page currently delivers a **worse** UX than the free preview. Users pay 100 pistons and land on a sparse, single-column layout with a small sticky header and no editorial structure — while the preview (which they see *before* paying) has a beautifully composed sidebar TOC, a large editorial hero, and section dividers with full Heritage Lavender branding.

This document specifies the rebuild of the report screen so that paying customers receive the **same or better** layout as the preview, plus a new piston-spend confirmation step that explains what they are about to receive.

**Frontend-only scope.** No API routes, no DB schema, no AI pipeline changes. Everything in this spec lives in `src/app/[locale]/cars/[make]/[id]/report/` and `src/components/report/`.

---

## 2. Goals

1. The paid report uses the same layout shell as the preview (sidebar TOC + editorial hero + section headers + Heritage Lavender branding).
2. Users get a pedagogical confirmation modal before pistons are spent, so they understand what they are buying.
3. Users without enough pistons are routed to the existing top-up flow without seeing a misleading confirmation step.
4. Mobile experience matches the editorial quality of desktop (sticky pill nav, 16:9 hero, generous whitespace).
5. The codebase ends up with **one** report client component, not two parallel ones.

## 3. Non-goals

- PDF redesign (covered by separate task in this branch)
- Tooltips / `risk score` explanations (separate task — could be a follow-up)
- Chat with quick replies (separate task)
- $59/mo subscription wiring (separate task)
- Any changes to `/api/analyze`, `/api/analyze/v3`, `deductCredit`, `user_credits`, or server-side report generation
- Changes to `brandConfig.ts` or Porsche taxonomy
- New marketing copy beyond the modal vocabulary

---

## 4. Current state

The router (`src/app/[locale]/cars/[make]/[id]/report/page.tsx:257`) branches:

```ts
userHasAccess && (existingReport || v3Report)
  ? <ReportClientV2 .../>   // 681 LOC — sparse, no sidebar, no hero
  : <ReportClient   .../>   // 3043 LOC — sidebar + hero + paywall sections
```

**V1 (`ReportClient.tsx`)** — shown to preview users and to paid users with no V3 yet. Has:
- Fixed left sidebar (240px) with TOC of 9 sections (summary, identity, valuation, performance, risk, dueDiligence, marketContext, similar, verdict)
- 21:9 editorial hero with car photo + gradient overlay + title chip "FREE PREVIEW"
- Section headers with eyebrow ("SECTION 01") + icon + title
- Paywall blur on locked sections with `Unlock 100 pistons` CTA
- Mobile: sticky horizontal pills + 16:9 hero
- Download Sheet for paid users (PDF / Excel)

**V2 (`ReportClientV2.tsx`)** — shown to paid users once V3 is available. Has:
- Sticky top header with title + date (small)
- Single-column content with V3 section components
- No sidebar, no hero, minimal visual hierarchy
- Inline `OutOfPistonsModal` for 402 responses

**The diagnosis:** V2 is functionally newer (it renders the V3 AI output) but visually inferior. The fix is not to redesign V2 — it is to **delete V2** and have V1 render the V3 content inside its existing layout shell.

---

## 5. Target architecture

### 5.1 File tree (after)

```
src/app/[locale]/cars/[make]/[id]/report/
├── page.tsx              ← simplified branching
└── ReportClient.tsx      ← unified (handles preview + paid)

src/components/report/
├── ConfirmGenerateModal.tsx   ← NEW
├── GenerationStepper.tsx      ← unchanged
├── HausReportTeaser.tsx       ← unchanged
├── OutOfPistonsModal.tsx      ← unchanged
├── SeeSampleModal.tsx         ← unchanged
└── sections/                  ← NEW folder (extracted V3 section renderers)
    ├── SummarySection.tsx
    ├── IdentitySection.tsx
    ├── ValuationSection.tsx
    ├── PerformanceSection.tsx
    ├── RiskSection.tsx
    ├── DueDiligenceSection.tsx
    ├── MarketContextSection.tsx
    ├── SimilarListingsSection.tsx
    └── VerdictSection.tsx
```

### 5.2 Deletions

| File | Action | LOC delta |
|------|--------|-----------|
| `src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx` | delete | -681 |

### 5.3 Edits

| File | Change | LOC delta (approx) |
|------|--------|--------------------|
| `src/app/[locale]/cars/[make]/[id]/report/page.tsx` | Always render `<ReportClient>`, pass `userHasAccess` + `v3Report` props | -10 |
| `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx` | Accept `v3Report` prop, render V3 content when `hasAccess=true`, refactor `handleUnlock` to open `ConfirmGenerateModal` first | +120 |

### 5.4 New files

| File | Purpose | LOC (est.) |
|------|---------|------------|
| `src/components/report/ConfirmGenerateModal.tsx` | Radix Dialog with car summary + cost + included sections + Confirmar/Cancelar | 150 |
| `src/components/report/sections/*.tsx` | One small component per V3 section type (extracted from V2 for reuse) | ~675 (9 × ~75 each) |

**Net LOC delta:** roughly `−681 − 10 + 120 + 150 + 675 = +254`. (We trade 681 lines of V2 for ~825 lines of reusable section components plus the new modal.)

### 5.5 Data flow

```
page.tsx (server component)
  ├─ fetch listing + reports
  ├─ resolve userHasAccess (existing logic, untouched)
  └─ pass props → ReportClient

ReportClient (client component)
  ├─ Sidebar TOC + Hero + Sections grid
  ├─ if !userHasAccess:
  │    └─ render SummarySection unlocked + 02-09 with PaywallSection wrapper
  └─ if userHasAccess:
       └─ render SummarySection..VerdictSection, all unlocked
            (each section pulls its data from v3Report prop)

ReportClient.handleUnlock()
  ├─ if balance < 100: setOutOfPistonsOpen(true) → return
  └─ else: setConfirmOpen(true)

ConfirmGenerateModal.onConfirm()
  └─ existing AI generation flow (unchanged API: POST /api/analyze/v3)
       └─ GenerationStepper takes over the screen

GenerationStepper.onComplete()
  └─ existing redirect / reload behavior (untouched)
```

**No backend changes.** The API contract is unchanged. The modal is purely client-side gatekeeping.

---

## 6. UX design

### 6.1 Desktop layout (≥768px)

```
┌──────────────────┬───────────────────────────────────────────────────┐
│ ← Vehicle        │   ┌─────────────── HERO 21:9 ─────────────────┐  │
│ 911 GT3 Touring  │   │     [foto gigante del carro]              │  │
│ ───────────      │   │     gradient overlay bottom (noir/70%)    │  │
│                  │   │     HAUS REPORT · 911 GT3 TOURING (44px)  │  │
│ 01 ⭐ Summary    │   │     PTS Gulf Blue · 4,200mi (13px)        │  │
│ 02 ⚙ Identity    │   │     Generated May 14, 2026 (mono 11px)    │  │
│ 03 $ Valuation   │   └────────────────────────────────────────────┘ │
│ 04 ⚡ Performance│                                                    │
│ 05 ⚠ Risk        │   ┌────────────────────────────────────────────┐ │
│ 06 🔍 Due Dilig. │   │ ↗ View source listing on Bring a Trailer   │ │
│ 07 📊 Market     │   └────────────────────────────────────────────┘ │
│ 08 🚗 Similar    │                                                    │
│ ──────────       │   SECTION 01  (eyebrow 10px tracking 0.25em)      │
│                  │   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━     │
│  287 pistons     │   ⭐  SUMMARY  (Cormorant 28-34px)                 │
│  ┌────────────┐  │   ─────────────────────────────────────           │
│  │ ↓ Download │  │   Two-line editorial summary aquí. Karla 14px.    │
│  └────────────┘  │   ┌──────────────────┬──────────────────┐         │
│                  │   │ FAIR VALUE       │ RISK SCORE       │         │
│                  │   │ $312,500         │ Low · 24/100     │         │
│                  │   │ -2.4% vs ask     │ tooltip ⓘ        │         │
│                  │   └──────────────────┴──────────────────┘         │
│                  │                                                    │
│                  │   SECTION 02  ⚙  IDENTITY & SPEC                  │
│                  │   ...                                              │
└──────────────────┴───────────────────────────────────────────────────┘
   240px (Soft Beige        max-w-[860px], Cream bg
   light / Noir Card dark)
```

**Specs:**
- Sidebar: 240px wide, fixed full-height, starts below app header (`pt-[var(--app-header-h,80px)]`)
- Sidebar items: number (Geist Mono 10px tabular) + icon (Lucide 14px) + label (Karla 11px medium)
- Sidebar active state: `bg-[rgba(214,190,220,0.20)]` + `text-[#3F2A47]` (light) / `bg-[rgba(225,204,229,0.16)]` + `text-[#E1CCE5]` (dark)
- Sidebar footer: balance count (Geist Mono 13px) + primary action button
- Main content: `max-w-[860px] mx-auto px-8 pt-6`
- Hero: `aspect-[21/9] rounded-3xl overflow-hidden`, image with `object-cover` + `priority`
- Hero gradient: `from-noir/70 via-noir/30 to-transparent`
- Section spacing: `gap-y-16` between sections
- Subtle noise overlay: SVG fractal noise fixed background, opacity 0.012 light / 0.020 dark, main content only (not sidebar)

### 6.2 Mobile layout (≤768px)

```
┌─────────────────────────────────┐
│ ← [01⭐][02⚙][03$][04⚡][05⚠][06🔍][07📊][08🚗][09🏆]→ │ sticky h=44px
├─────────────────────────────────┤   backdrop-blur-xl
│  ┌───────────────────────────┐  │
│  │   [HERO 16:9]             │  │
│  │   911 GT3 Touring         │  │
│  │   (Cormorant 24px)        │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ ↗ View source listing     │  │
│  └───────────────────────────┘  │
│                                 │
│  SECTION 01                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━     │
│  ⭐ SUMMARY (Cormorant 22px)    │
│  ─────────────────────          │
│  Body Karla 14px line-h 1.65   │
│                                 │
│  ┌───────────┐ ┌────────────┐   │
│  │FAIR VALUE │ │ RISK SCORE │   │
│  │$312.5k    │ │ Low · 24   │   │
│  └───────────┘ └────────────┘   │
│                                 │
│  SECTION 02 …                   │
│                                 │
│  ─── (after last section) ───   │
│  ┌───────────────────────────┐  │
│  │  287 pistons              │  │
│  │  [ ↓ Download report   ]  │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Specs:**
- Top bar: `fixed top-0 left-0 right-0 z-50 h-11 bg-background/95 backdrop-blur-xl border-b`
- Pills: scrollable horizontal `gap-1.5`, each `h-7 rounded-full px-3 py-1.5 text-[10px]`
- Pills active: `bg-primary/15 text-primary border-primary/20`
- Pills locked (preview): icon Lock replaces section icon
- Hero: `aspect-[16/9] rounded-2xl`
- Container: `px-4 pt-[52px] pb-24`
- Section spacing: `gap-y-10`
- Footer: card with balance + full-width download button, **not** sticky (avoid covering content)
- Touch targets: minimum effective 44px tap area via padding

### 6.3 Confirmation modal (`ConfirmGenerateModal`)

**Desktop** — Radix Dialog overlay, content max-w-[480px], centered, fade-in + slide-up 200ms:

```
                ┌──────────────────────────────────────────┐
                │  ✕                                        │
                │                                           │
                │   HAUS REPORT (Karla 10px, tracking 0.25em)
                │   ─────────                               │
                │   2023 Porsche 911 GT3 Touring            │
                │   (Cormorant 24px)                        │
                │   Paint-to-Sample Gulf Blue · 4,200mi     │
                │   (Karla 13px, Stone color)               │
                │                                           │
                │   ┌─────────────────────────────────┐    │
                │   │  Includes 9 sections:           │    │
                │   │  ✓ Executive summary            │    │
                │   │  ✓ Identity & spec              │    │
                │   │  ✓ Fair value & comparables     │    │
                │   │  ✓ Performance benchmark        │    │
                │   │  ✓ Risk score & due diligence   │    │
                │   │  ✓ Market context & timing      │    │
                │   │  ✓ Similar listings nearby      │    │
                │   │  ✓ Final verdict                │    │
                │   │  ✓ PDF + Excel downloadables    │    │
                │   └─────────────────────────────────┘    │
                │                                           │
                │   ┌─────────────────────────────────┐    │
                │   │  Cost:     100 pistons          │    │
                │   │  Balance:  287 → 187 pistons    │    │
                │   │  (Geist Mono 13px)              │    │
                │   └─────────────────────────────────┘    │
                │                                           │
                │   [  Cancel  ]  [  Generate report  ]    │
                │                       ↑ Lavender Deep    │
                └──────────────────────────────────────────┘
```

**Mobile** — bottom sheet, full-width, max-h-[85vh], slide-up:

```
┌───────────────────────────┐
│  ━━━ (drag handle)        │
│  ✕                        │
│   HAUS REPORT             │
│   2023 911 GT3 Touring    │
│   PTS Gulf Blue           │
│                           │
│   Includes 9 sections:    │
│   ✓ Executive summary     │
│   ✓ Identity & spec       │
│   ✓ Fair value & comps    │
│   ✓ Performance benchmark │
│   ✓ Risk & due diligence  │
│   ✓ Market context        │
│   ✓ Similar listings      │
│   ✓ Final verdict         │
│   ✓ PDF + Excel           │
│                           │
│   ─────────────────────   │
│   Cost:    100 pistons    │
│   Balance: 287 → 187      │
│   ─────────────────────   │
│                           │
│  ┌─────────────────────┐  │
│  │  Generate report    │  │  primary
│  └─────────────────────┘  │
│  ┌─────────────────────┐  │
│  │  Cancel             │  │  ghost
│  └─────────────────────┘  │
└───────────────────────────┘
```

**Behavior:**
- Open trigger: any click on `Unlock {N} pistons` CTAs (sidebar footer, paywall section overlays, top hero chip in preview mode)
- Open precondition: `balance >= 100`. If `balance < 100`, the click opens `OutOfPistonsModal` directly instead — `ConfirmGenerateModal` never appears with an insufficient balance.
- ESC, click outside, or `[Cancel]` → close, return user to the same view
- `[Generate report]` → close modal AND open `GenerationStepper` in a single transition (crossfade, no flash of background)
- The `Generate report` button is `disabled` while the underlying mutation is pending (prevents double-click)
- Balance line updates live if a prop change comes in before confirm

---

## 7. Branding tokens (Heritage Lavender v2.1)

| Surface | Light | Dark |
|---------|-------|------|
| Sidebar background | `#F5F2EE` (Soft Beige) | `#161114` (Noir Card) |
| Main background | `#FDFBF9` (Cream) | `#0E0E0D` (Noir) |
| Body text | `#141413` (Ink) | `#E8E2DE` (Bone) |
| Eyebrow / metadata | `#9A8E88` (Stone) | `#6B6365` (Stone Dark) |
| Divider | `#E8E2DC` (Warm Border) | `#2A2226` (Dark Border) |
| Section icon background | `#F1E6F3` (Lavender Veil) | `rgba(225, 204, 229, 0.10)` |
| Section icon foreground | `#5D3F66` (Lavender Ink) | `#E1CCE5` (Heritage Lavender) |
| CTA primary | `#D6BEDC` (Lavender Deep) | `#E1CCE5` (Heritage Lavender) |
| CTA text | `#141413` (Ink) | `#0E0E0D` (Noir) |
| Active TOC item bg | `rgba(214, 190, 220, 0.20)` | `rgba(225, 204, 229, 0.16)` |
| Active TOC item text | `#3F2A47` (Lavender Ink Deep) | `#E1CCE5` |

**Financial indicators (never red):**
- Positive / growth / "buy zone" → `#34D399` (Emerald Mint)
- Negative / risk elevated / "wait" → `#FB923C` (Burnt Orange)
- Caution / sparse data → `#FBBF24` (Amber)

**Typography roles:**

| Element | Font | Weight | Size | Tracking |
|---------|------|--------|------|----------|
| Hero H1 | Cormorant | 400 | `text-[44px] md:text-[56px]` | `-0.02em` |
| Hero subtitle | Karla | 400 | `text-[13px]` | normal |
| Generated date | Geist Mono | 400 | `text-[11px]` | normal |
| Sidebar car title | Cormorant | 500 | `text-[15px]` | `-0.01em` |
| Sidebar TOC label | Karla | 500 | `text-[11px]` | normal |
| Sidebar TOC number | Geist Mono | 400 | `text-[10px]` tabular-nums | normal |
| Section eyebrow | Karla | 500 | `text-[10px]` | `0.25em` UPPERCASE |
| Section title | Cormorant | 500 | `text-[28px] md:text-[34px]` | `-0.02em` |
| Body paragraph | Karla | 400 | `text-[14px]` line-h 1.65 | normal |
| Data card label | Karla | 500 | `text-[10px]` | `0.2em` UPPERCASE |
| Data card value | Cormorant | 500 | `text-[28px]` | `-0.02em` |
| Numbers / dates / VINs | Geist Mono | 400 | `text-[12px]` tabular-nums | normal |
| Balance display | Geist Mono | 500 | `text-[13px]` | normal |

Saira (wordmark font) does **not** appear on the report screen. It is reserved for the helmet wordmark, which only appears in the global app header and inside the PDF footer (separate scope).

**Microinteractions:**

| Trigger | Animation | Curve | Duration |
|---------|-----------|-------|----------|
| Hover on TOC item | bg fade + slide right 2px | `cubic-bezier(0.4, 0, 0.2, 1)` | 250ms |
| Click TOC → section | smooth scroll | native | ~600ms |
| Click Unlock → modal | overlay fade + content slide-up | Radix default | ~200ms |
| Confirm → GenerationStepper | crossfade | smooth | 250ms |
| Section enters viewport | opacity 0→1, translateY 8px→0 | smooth | 400ms |
| Data card hover | translateY -2px + shadow grow | bounce | 400ms |
| Tooltip (Risk Score ⓘ) | fade + slide-up 4px | smooth | 150ms |

**Voice (Salon vocabulary):**

| Avoid | Use instead |
|-------|-------------|
| "Buy this car" | "Acquisition opportunity" |
| "Price history" | "Provenance & market history" |
| "Good deal" | "Accessible entry point" |
| "Bad option" | "Limited investment thesis" |
| "Old car" | "Vintage / classic" |
| "Users like you bought" | "Collectors with this profile" |
| "Buy now!" | (never — no urgency pressure) |

**Salon test:** before merging, every screen should pass the test *"Would this feel at home in a contemporary art gallery?"* If not, remove rather than add.

**Effects budget:**
- Glassmorphism: maximum **one** element per viewport. Allocation: the sticky mobile top bar (`backdrop-blur-xl` on `bg-background/95`). Sidebar uses solid Noir Card / Soft Beige.
- Noise: SVG fractal noise overlay, opacity 0.012 light / 0.020 dark, fixed in main content background only.
- Shadows: subtle, never harsh. Use `box-shadow: 0 8px 40px rgba(0,0,0,0.06)` light, `0 8px 40px rgba(0,0,0,0.5)` dark.

---

## 8. Acceptance criteria

When this is done, all of the following must be true:

1. The route `/{locale}/cars/{make}/{id}/report` always renders a single component (`ReportClient`), never two.
2. A user without access sees: hero + Summary unlocked + sections 02–09 with paywall blur + `Unlock 100 pistons` CTA.
3. A user with access sees: hero + all nine sections fully rendered, no blur, no Lock icons.
4. Clicking any `Unlock 100 pistons` CTA when `balance >= 100` opens the `ConfirmGenerateModal`.
5. Clicking `Unlock 100 pistons` when `balance < 100` opens `OutOfPistonsModal` directly. `ConfirmGenerateModal` never appears with insufficient balance.
6. Clicking `Generate report` inside the confirmation modal closes the modal and shows the existing `GenerationStepper`, with no white flash and no background flicker.
7. Clicking `Cancel` inside the modal returns the user to the same view, no navigation.
8. The sidebar TOC scrolls smoothly to a section on click, and the active item reflects the section currently in viewport.
9. Mobile (≤768px): sticky top with horizontal pills, 16:9 hero, no fixed sidebar.
10. Desktop (≥768px): 240px fixed sidebar, 21:9 hero, `max-w-[860px]` centered main content.
11. Switching theme (light ↔ dark) updates all tokens correctly. The report respects the global theme setting.
12. Cormorant is used for H1 and section titles; Karla for body and labels; Geist Mono for numbers, dates, VINs. Saira does **not** appear on the report screen.
13. Financial indicators use Emerald, Burnt Orange, or Amber — **never** red.
14. `ReportClientV2.tsx` is deleted from the repo.
15. `page.tsx` is simplified to always render `<ReportClient>` regardless of `userHasAccess`.
16. Mock fixtures still work: `?mock=992gt3`, `?mock=v3`, `?mock=sparse` all render correctly with paid layout.
17. `GenerationStepper.tsx`, `OutOfPistonsModal.tsx`, `HausReportTeaser.tsx`, `SeeSampleModal.tsx` are not modified.
18. TypeScript compiles, ESLint passes with no new warnings, the dev server starts without runtime errors.
19. The Salon test passes: no element feels "loud" or "tech-blue" or "corporate".
20. No backend file is modified. Diff for `src/app/api/**` and `src/lib/reports/queries.ts` is zero.

---

## 9. Edge cases

| Scenario | Behavior |
|----------|----------|
| Balance drops below 100 between modal open and confirm (other tab consumed credits) | API returns 402 on `POST /api/analyze/v3` → close `ConfirmGenerateModal`, open `OutOfPistonsModal` |
| Existing V3 report in DB but user has lost access (sub expired) | Render preview layout; `v3Report` data is not leaked to the rendered HTML |
| `?mock=...` query without login | Continue current behavior: treat as paid, render full report |
| Locale switch mid-view | Page reloads with new locale; scroll position reset is acceptable |
| `POST /api/analyze/v3` takes >30s | `GenerationStepper` continues showing progress; no client-side timeout |
| Hero image fails to load | `SafeImage` fallback shows title text on `bg-muted` |
| Dark mode hero overlay | Gradient stays `from-noir/70 via-noir/30 to-transparent` — never blue-tinted |
| User double-clicks `Generate report` | Button is `disabled` while mutation pending |
| ESC while `ConfirmGenerateModal` open | Cancels and closes (Radix native) |
| Sidebar TOC scrolled to a section but user manually scrolls back | Active item updates with intersection observer (existing logic in V1) |
| Mobile keyboard opens (unlikely but possible if textarea appears) | Layout remains stable; no content shifts |

---

## 10. Risks & mitigations

1. **`ReportClient` is already 3,043 LOC.** Folding V3 content in may push it past comfortable readability. *Mitigation:* extract V3 section renderers into `src/components/report/sections/*.tsx` (one per section type), import them into `ReportClient`. Aim to keep `ReportClient.tsx` under 3,500 LOC and refactor later if it goes over.
2. **V1 has its own `handleUnlock` that already calls `/api/analyze` (legacy, not v3).** *Mitigation:* during implementation, audit `handleUnlock` line-by-line, preserve every existing state and side-effect, and only re-route the API call to `/api/analyze/v3` if it isn't already. If the legacy call still matters for non-V3 paths, keep both with a feature flag based on whether `v3Report` exists.
3. **Section IDs may differ between V1's `SECTION_IDS` constant and V3's section schema.** *Mitigation:* reconcile to a single source of truth; V1 currently declares 9 IDs (`summary`, `identity`, `valuation`, `performance`, `risk`, `dueDiligence`, `marketContext`, `similar`, `verdict`). If V3 has more granular sections, map them into these 9 V1 slots (or expand V1's list, but only if confirmed during implementation review).
4. **Animation of "close modal + open GenerationStepper" can flicker** if both unmount/mount sequentially. *Mitigation:* drive both from a single `phase` state (`'idle' | 'confirming' | 'generating' | 'done'`) so React renders the crossfade in one frame.
5. **Large hero image on slow connections** can dominate LCP. *Mitigation:* keep `priority` on `SafeImage`, set explicit `sizes`, ensure `object-cover` so dimensions are stable. Don't add a placeholder blur — V1 doesn't and that's fine.

---

## 11. Out of scope (explicit guardrails)

This spec does NOT cover and the implementation will NOT touch:

- PDF redesign — separate task in this branch
- Tooltips for risk score / metrics — separate task
- Chat + quick replies — separate task
- $59/mo subscription — separate task
- AI pipeline (`/api/analyze`, `/api/analyze/v3`, `deductCredit`, model prompts)
- Database schema or `user_credits` table
- `brandConfig.ts` or Porsche taxonomy
- Server-side report generation logic
- New marketing or product copy beyond modal text
- Pricing changes (100 pistons / 300 monthly allowance stays as is)
- Authentication, locale routing, middleware

If any of these are touched during implementation, the change should be rejected in review and reverted.

---

## 12. Open questions

None. All decisions confirmed during the brainstorming session 2026-05-14.

---

## 13. References

- Fireflies meeting: `01KRMA2Y1JG4DAFTYT42WTTSWZ` — Camilo Echeverri & Edgar Navarro, 2026-05-14
- Prior spec: `docs/superpowers/specs/2026-04-21-haus-report-v2-design.md` (V2 pipeline — keeping its backend, replacing its frontend)
- Brand manual: MonzaHaus Brand System v2.1 (Heritage Lavender Edition)
- Current code references:
  - `src/app/[locale]/cars/[make]/[id]/report/page.tsx:257` (V1/V2 branch)
  - `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx:1594` (V1 root return)
  - `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx:1633` (desktop sidebar)
  - `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx:1724` (hero)
  - `src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx:247` (the comment that diagnosed this very problem)
  - `src/lib/reports/queries.ts:23` (`REPORT_PISTON_COST = 100`)
  - `src/components/payments/OutOfPistonsModal.tsx` (existing top-up flow)
  - `src/components/report/GenerationStepper.tsx` (existing full-screen progress)
