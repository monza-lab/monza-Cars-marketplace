# MonzaHaus Landing Page + Onboarding — Design Spec

> Date: 2026-06-03
> Branch: `landing-page-front`
> Scope: Frontend only — no backend, API, scraper, or auth logic changes

---

## Overview

Transform the MonzaHaus entry experience from dashboard-first to narrative-first. New visitors land on a marketing page that communicates the platform vision (ecosystem of value around Porsche, not just BI), then flow into the product. Authenticated users bypass the landing and go straight to the dashboard.

## Deliverables

1. Landing page at `/` for unauthenticated visitors
2. Welcome modal on first dashboard visit
3. Contextual onboarding tooltips in the dashboard
4. "Powered by Monza Lab" footer badge

---

## 1. Landing Page

### Routing Architecture

**Current state:**
- `/` renders `DashboardClient` for everyone (SSR with auction data)

**New state:**
- `/` checks auth status
  - Unauthenticated → render `LandingPage` component (static, no data fetch)
  - Authenticated → render `DashboardClient` (existing behavior, unchanged)
- "Explore the Market" CTA navigates to `/browse` (public, no auth required)

**Implementation approach:**
- Modify `src/app/[locale]/page.tsx` to conditionally render based on auth
- New component: `src/components/landing/LandingPage.tsx` (client component)
- Section components under `src/components/landing/sections/`
- Dashboard code stays untouched — just conditionally rendered

### Narrative Structure — "The Collector's Edge"

Persona-centric: identify problem → reveal solution → show ecosystem → invite action.

#### Section 1: Hero (fullscreen)

- **Background:** Noir (`#0E0E0D`) with lavender radial glow at top center
- **Content:** centered, max-width 720px
- **Headline:** Cormorant Light (300), ~3rem, color Bone (`#E8E2DE`)
  - Copy direction: stat-driven hook about the collector car market being opaque/underserved
- **Subline:** Karla 400, ~1.1rem, color Stone Dark (`#6B6365`), max 2 lines
  - Positions MonzaHaus as the solution without listing features
- **CTA:** "Explore the Market" — button with Lavender Deep (`#D6BEDC`) bg, Lavender Ink Deep (`#3F2A47`) text, radius-lg
- **Visual:** subtle Porsche silhouette or gradient shape — NOT a full photo to avoid stock-photo feel. Keep it abstract/Salon.
- **Noise overlay:** 2% opacity (dark mode standard)

#### Section 2: Problem (3 pain points)

- **Background:** Warm Cream (`#FDFBF9`) with noise overlay 1.2%
- **Layout:** 3-column grid (stacks on mobile)
- **Each column:**
  - Abstract icon or number (Cormorant 500, Lavender Deep)
  - Headline: Karla 600, Ink, ~0.95rem
  - Description: Karla 400, Stone, 2-3 lines
- **Pain points:**
  1. Market opacity — pricing data scattered, no single source of truth
  2. Gut-feel decisions — six-figure assets bought on emotion, not data
  3. Knowledge gap — provenance, specs, market context locked in forums and hearsay

#### Section 3: Solution / Ecosystem Reveal

- **Background:** Soft Beige (`#F5F2EE`)
- **Section header:** Cormorant 400, centered, "One platform. Every angle."
- **Layout:** staggered card grid (2 cols desktop, 1 col mobile)
- **5 ecosystem cards:**
  1. **Market Intelligence** — live listings across US, EU, UK, JP
  2. **Investment Reports** — AI-powered analysis: fair value, comparables, risk
  3. **Knowledge Base** — model guides, variant breakdowns, buyer education
  4. **Market Indices** — air-cooled, water-cooled, GT, Turbo trend tracking
  5. **AI Advisor** — conversational market intelligence on demand
- **Card style:** Warm Cream bg, Warm Border, radius-xl, hover lift (translateY -2px, shadow increase)
- **Each card:** Cormorant 500 title + Karla 400 description (2-3 lines). No screenshots.

#### Section 4: Social Proof / Numbers

- **Background:** Noir with lavender glow
- **Layout:** horizontal row of 3-4 stats, centered
- **Stats (pull from actual data if available, otherwise hardcode reasonable numbers):**
  - Listings tracked (e.g., "12,000+")
  - Markets covered ("4 regions")
  - Data sources integrated (count of scrapers/sources)
  - Reports generated (if available)
- **Style:** number in Cormorant 500, large (2.5rem), Heritage Lavender. Label in Karla 400, Stone Dark. Animate on scroll (count up).

#### Section 5: Vision / Manifesto

- **Background:** Warm Cream
- **Content:** centered text block, max-width 600px
- **Headline:** Cormorant 300, ~2rem, Ink
  - Copy direction: "More than a platform" — data + knowledge + community
- **Body:** Karla 400, Stone, 3-4 lines about the long-term vision
- **No CTA here** — breathing room before final push

#### Section 6: Final CTA

- **Background:** Noir with lavender glow
- **Primary CTA:** "Explore the Market" → `/browse`
- **Secondary CTA:** "Get a Free Report" → `/get-started` (text link or ghost button)
- **Below CTAs:** subtle "No account required" reassurance text in Stone Dark

### Landing Page — NOT included

- No header navigation on landing (just the MonzaHaus wordmark top-left)
- No dashboard data fetching
- No auth forms on the page itself (auth happens when they hit product pages)
- No pricing section (they have `/pricing` for that)
- No testimonials (too early, no real testimonials yet)

---

## 2. Welcome Modal

### Trigger

- Fires when `DashboardClient` mounts AND `localStorage.getItem('monzahaus-onboarded') !== 'true'`
- Sets `localStorage.setItem('monzahaus-onboarded', 'true')` on dismiss
- Works for both authenticated users and anonymous visitors to `/browse`

### Design

- **Container:** centered Dialog/modal, max-width 480px, card bg with glassmorphism
- **Close:** "x" button top-right + click-outside-to-close + Esc
- **Content:**
  - MonzaHaus wordmark (Saira 600 + helmet) at top, small
  - Headline: "Welcome to MonzaHaus" — Cormorant 400
  - 3 bullet rows (icon + text):
    - "Browse thousands of collector Porsches across 4 regions"
    - "Get AI-powered investment reports on any listing"
    - "Track market trends with real-time indices"
  - Icons: simple, Salon-style (Map, FileText, TrendingUp from Lucide). NOT Sparkles/Wand2/Bot.
  - Text: Karla 400, Ink
- **CTA:** "Start Exploring" — Lavender Deep button, full-width
- **No steps, no carousel, no progress dots.** Single panel.

### Component

- New file: `src/components/onboarding/WelcomeModal.tsx`
- Uses existing `Dialog` from `src/components/ui/dialog.tsx`

---

## 3. Contextual Onboarding Tooltips

### Storage

Each tooltip tracked individually in localStorage:
- `onboarding-tip-regions`
- `onboarding-tip-search`
- `onboarding-tip-listing`
- `onboarding-tip-advisor`

### Tooltip Definitions

| ID | Target Element | Text | Position |
|----|---------------|------|----------|
| `regions` | Region pills in Header | "Filter listings by region — US, UK, EU, or Japan" | bottom |
| `search` | Search trigger in Header | "Search any Porsche by model, year, or paste an auction URL" | bottom |
| `listing` | First listing card in feed | "Click any listing for details. Request a report for the full picture." | top |
| `advisor` | AdvisorFab button | "Ask our AI advisor anything about the collector market" | left |

### Behavior

- Tooltips appear sequentially after WelcomeModal is dismissed (or if already onboarded, skip)
- 1.5s delay between each tooltip appearing
- Each tooltip auto-dismisses after 6s OR on user click
- Popover style: Lavender Veil (`#F1E6F3`) bg, Lavender Ink (`#5D3F66`) text, radius-md, small arrow pointing to target
- Only show on desktop (hidden on mobile to avoid clutter over mobile nav)

### Component

- New file: `src/components/onboarding/OnboardingTooltips.tsx`
- Wraps a lightweight popover system (can use Radix Popover or custom positioned div)
- Rendered in the locale layout, reads tooltip state from localStorage

---

## 4. Footer — "Powered by Monza Lab"

### Change

Add to existing `AppFooter.tsx` after the copyright/legal links.

### Design

- Separator: `·` dot (same as existing separators)
- Text: "Powered by" in Stone/muted-foreground
- Helmet SVG: Monza Lab helmet (inline SVG), ~12px height, shell Lavender Deep, visor Ink
- "Monza Lab" text: Stone/muted-foreground
- Whole unit is an `<a>` linking to `https://monzalab.com`, `target="_blank"`, `rel="noopener"`
- Same 10px size as existing footer text

### i18n

No translation needed — "Powered by Monza Lab" stays in English across all locales (brand name).

---

## Component Tree (new files)

```
src/components/landing/
  LandingPage.tsx              — main landing component
  sections/
    HeroSection.tsx            — fullscreen hero with CTA
    ProblemSection.tsx         — 3 pain point columns
    EcosystemSection.tsx       — 5 feature cards
    SocialProofSection.tsx     — stats counters
    VisionSection.tsx          — manifesto text
    CtaSection.tsx             — final CTA block
    LandingHeader.tsx          — minimal header (wordmark only)
    LandingFooter.tsx          — reuses AppFooter

src/components/onboarding/
  WelcomeModal.tsx             — first-visit welcome dialog
  OnboardingTooltips.tsx       — contextual tooltip system
  OnboardingTooltip.tsx        — individual tooltip component
```

## Modified Files

```
src/app/[locale]/page.tsx      — conditional render (landing vs dashboard)
src/app/[locale]/layout.tsx    — add OnboardingTooltips to provider tree
src/components/layout/AppFooter.tsx — add "Powered by Monza Lab"
messages/en.json               — landing page copy + onboarding strings
messages/es.json               — translations
messages/de.json               — translations
messages/ja.json               — translations
```

## Technical Notes

- Landing page is a client component but requires no data fetching — fully static/cacheable
- Auth check in `page.tsx` uses existing `AuthProvider` / `useAuth()` context
- All onboarding state is localStorage-only — no backend, no cookies
- Scroll animations (counter, section reveals) use Intersection Observer, no heavy animation library
- All copy goes through next-intl for i18n support
- MonzaHaus branding v2.1 Heritage Lavender palette throughout
- Responsive: mobile-first, sections stack vertically

## Out of Scope

- Paint to Sample identification/surfacing (separate feature)
- Search UI changes (already done)
- Pricing page changes
- Auth flow modifications
- Dashboard layout changes
- Backend/API changes
