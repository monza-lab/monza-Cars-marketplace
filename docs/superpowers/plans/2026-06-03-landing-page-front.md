# Landing Page + Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a narrative landing page for unauthenticated visitors, welcome modal, contextual tooltips, and "Powered by Monza Lab" footer badge — all mobile-first, MonzaHaus branding v2.1.

**Architecture:** Landing page renders as a fixed full-viewport overlay (`z-[100]`) from page.tsx when user is not authenticated, covering the app shell without modifying layout.tsx. CTA navigates to `/browse` which unmounts the overlay. Welcome modal + tooltips live in layout and trigger via localStorage flags. Footer badge is a simple addition to AppFooter.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, next-intl, Radix Dialog, Lucide icons, Intersection Observer for scroll animations.

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/components/landing/LandingPage.tsx` | Full-viewport landing composition |
| `src/components/landing/sections/HeroSection.tsx` | Fullscreen hero with CTA |
| `src/components/landing/sections/ProblemSection.tsx` | 3 pain point columns |
| `src/components/landing/sections/EcosystemSection.tsx` | 5 feature cards |
| `src/components/landing/sections/SocialProofSection.tsx` | Stats counters with scroll animation |
| `src/components/landing/sections/VisionSection.tsx` | Manifesto text |
| `src/components/landing/sections/CtaSection.tsx` | Final CTA block |
| `src/components/landing/sections/LandingHeader.tsx` | Minimal header (wordmark only) |
| `src/components/onboarding/WelcomeModal.tsx` | First-visit welcome dialog |
| `src/components/onboarding/OnboardingTooltips.tsx` | Sequential contextual tooltip system |
| `src/hooks/useScrollReveal.ts` | Intersection Observer hook for section animations |

### Modified Files
| File | Change |
|------|--------|
| `src/app/[locale]/page.tsx` | Wrap in client gate: auth → dashboard, no auth → landing |
| `src/app/[locale]/layout.tsx` | Add OnboardingTooltips + WelcomeModal |
| `src/components/layout/AppFooter.tsx` | Add "Powered by Monza Lab" with helmet |
| `messages/en.json` | Landing + onboarding copy |
| `messages/es.json` | Spanish translations |
| `messages/de.json` | German translations |
| `messages/ja.json` | Japanese translations |

---

## Task 1: Footer "Powered by Monza Lab"

**Files:**
- Modify: `src/components/layout/AppFooter.tsx`

- [ ] **Step 1: Add Powered by Monza Lab to footer**

```tsx
// AppFooter.tsx — add after the cookies link
<span className="text-border">·</span>
<a
  href="https://monzalab.com"
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors tracking-wide"
>
  Powered by
  <svg viewBox="0 0 120 121" className="h-[10px] w-[10px]" aria-hidden="true">
    <path d="M60 3C36 3 12 18 7 40C2 57 2 72 6 86L15 103C23 113 38 118 57 118L60 118L63 118C82 118 97 113 105 103L114 86C118 72 118 57 113 40C108 18 84 3 60 3Z" fill="#D6BEDC"/>
    <path d="M14 46C14 36 33 30 60 30C87 30 106 36 106 46L106 68C105 77 86 83 60 83C34 83 15 77 14 68Z" fill="#141413"/>
    <path d="M26 90Q60 86 94 90" stroke="#141413" strokeWidth="3" strokeLinecap="round" fill="none"/>
  </svg>
  Monza Lab
</a>
```

- [ ] **Step 2: Verify in browser** — footer should show the badge on desktop

---

## Task 2: useScrollReveal hook

**Files:**
- Create: `src/hooks/useScrollReveal.ts`

- [ ] **Step 1: Create Intersection Observer hook**

Hook that returns a ref and `isVisible` boolean. Triggers once when element enters viewport (threshold 0.15). Used by landing sections for fade-in-up animations.

---

## Task 3: Landing page sections (all 7 components)

**Files:**
- Create: `src/components/landing/sections/LandingHeader.tsx`
- Create: `src/components/landing/sections/HeroSection.tsx`
- Create: `src/components/landing/sections/ProblemSection.tsx`
- Create: `src/components/landing/sections/EcosystemSection.tsx`
- Create: `src/components/landing/sections/SocialProofSection.tsx`
- Create: `src/components/landing/sections/VisionSection.tsx`
- Create: `src/components/landing/sections/CtaSection.tsx`

All sections follow MonzaHaus v2.1 branding. Mobile-first layout (single column, stacks). Each section uses `useScrollReveal` for entrance animation.

### LandingHeader
- Fixed top, z-10 inside the landing overlay
- MonzaHausWordmark (tone "lavender-on-noir") left-aligned
- Background: transparent → `bg-noir/80 backdrop-blur` on scroll
- Mobile: smaller wordmark, same behavior

### HeroSection
- Full viewport height (`min-h-svh`)
- Noir bg with radial lavender glow at top center
- Noise overlay 2%
- Centered content, max-w-3xl
- H1: Cormorant 300, text-bone, text-3xl md:text-5xl
- Subtitle: Karla 400, text-stone-dark, text-base md:text-lg
- CTA: Lavender Deep bg, Lavender Ink Deep text, rounded-xl, py-3.5 px-8
- Scroll indicator: subtle animated chevron at bottom
- Mobile: text-2xl headline, full-width CTA button

### ProblemSection
- Warm Cream bg with noise overlay 1.2%
- Section padding: py-20 md:py-28
- 3 cards in grid (1 col mobile, 3 col md)
- Each: number in Cormorant 500 (Lavender Deep), title Karla 600, desc Karla 400 Stone
- Gap: gap-8 md:gap-12

### EcosystemSection
- Soft Beige bg
- Section header: Cormorant 400, centered
- 5 cards: 1 col mobile, 2 col md (last card centered)
- Card: Cream bg, warm-border, radius-xl, p-6 md:p-8
- Hover: translateY(-2px), shadow-lg, transition 0.25s
- Each: Lucide icon (Globe, FileText, BookOpen, TrendingUp, MessageCircle), Cormorant 500 title, Karla 400 desc

### SocialProofSection
- Noir bg with lavender glow
- 4 stats in horizontal row (2x2 grid mobile, 4 col md)
- Number: Cormorant 500, text-2xl md:text-4xl, Heritage Lavender
- Label: Karla 400, Stone Dark
- Counter animation: count from 0 on scroll enter (useScrollReveal)

### VisionSection
- Warm Cream bg
- Centered text block, max-w-xl
- H2: Cormorant 300, text-ink, text-2xl md:text-3xl
- Body: Karla 400, Stone, text-base, leading-relaxed

### CtaSection
- Noir bg with lavender glow
- Centered content, max-w-lg
- Primary: "Explore the Market" button (same as hero)
- Secondary: "Get a Free Report" — ghost button (border lavender-deep, text-bone)
- Below: "No account required" in stone-dark text-xs

---

## Task 4: LandingPage composition + HomeGate

**Files:**
- Create: `src/components/landing/LandingPage.tsx`
- Modify: `src/app/[locale]/page.tsx`

### LandingPage.tsx
- `"use client"` component
- Fixed full-viewport overlay: `fixed inset-0 z-[100] overflow-y-auto`
- Noir background (matches hero)
- Composes: LandingHeader + all sections + AppFooter (rendered inline, not from layout)
- Smooth scroll behavior (`scroll-smooth`)

### page.tsx changes
- Import `useAuth` via a new client wrapper component `HomeGate`
- HomeGate receives dashboard data as props (server still fetches)
- If `user` is null and `loading` is false → render LandingPage
- If authenticated → render DashboardClient (existing)
- While loading → render a minimal skeleton (Noir bg, centered helmet spinner)

---

## Task 5: Welcome Modal

**Files:**
- Create: `src/components/onboarding/WelcomeModal.tsx`
- Modify: `src/app/[locale]/layout.tsx`

### WelcomeModal.tsx
- Uses Radix Dialog from `src/components/ui/dialog.tsx`
- Checks `localStorage.getItem('monzahaus-onboarded')` on mount
- If not onboarded → open dialog
- On dismiss (button, x, outside click, Esc) → set localStorage flag
- Content:
  - MonzaHausWordmark (small, centered)
  - "Welcome to MonzaHaus" — Cormorant 400
  - 3 rows: icon + text (Map, FileText, TrendingUp from Lucide)
  - "Start Exploring" full-width Lavender Deep button
- Glassmorphism: `bg-card/90 backdrop-blur-xl border border-border`
- Max-width: 420px mobile (mx-4), 480px desktop
- Entrance animation: fade-in + slide-up

### layout.tsx change
- Add `<WelcomeModal />` inside MobileMotionProvider, after CookieBanner
- Component self-manages visibility via localStorage

---

## Task 6: Contextual Onboarding Tooltips

**Files:**
- Create: `src/components/onboarding/OnboardingTooltips.tsx`
- Modify: `src/app/[locale]/layout.tsx`

### OnboardingTooltips.tsx
- Client component that renders 4 positioned tooltips sequentially
- Each tooltip has a unique localStorage key (`onboarding-tip-{id}`)
- Only shows AFTER welcome modal is dismissed (checks `monzahaus-onboarded === 'true'`)
- Desktop only (`hidden` on mobile via media query check)
- Sequential: 1.5s delay between each
- Auto-dismiss after 6s or on click
- Targets found by `data-onboarding` attributes added to existing elements
- Style: Lavender Veil bg, Lavender Ink text, radius-md, small arrow, shadow-lg
- Positioned with `getBoundingClientRect()` + portal

### Modifications to existing components for data-onboarding attributes
- Header.tsx: add `data-onboarding="regions"` to region pills container
- Header.tsx: add `data-onboarding="search"` to search trigger
- AdvisorFab: add `data-onboarding="advisor"` to fab button

### layout.tsx change
- Add `<OnboardingTooltips />` after WelcomeModal

---

## Task 7: i18n strings

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`
- Modify: `messages/de.json`
- Modify: `messages/ja.json`

Add `landing` and `onboarding` namespaces to all locale files with all copy for landing sections, welcome modal, and tooltips.

---

## Task 8: QA & Visual Validation

- [ ] Run `npm run build` — verify no TypeScript or build errors
- [ ] Test in browser: unauthenticated → see landing page
- [ ] Test: click "Explore the Market" → navigate to /browse
- [ ] Test: sign in → "/" shows dashboard
- [ ] Test: welcome modal appears on first /browse visit
- [ ] Test: dismiss modal → tooltips sequence on desktop
- [ ] Test: refresh → modal and tooltips don't reappear
- [ ] Test: footer shows "Powered by Monza Lab" with helmet
- [ ] Test mobile viewport: all sections stack correctly, CTAs full-width
- [ ] Test: smooth scroll between sections
- [ ] Test: scroll reveal animations fire on each section
- [ ] Test: landing header blur effect on scroll
- [ ] Verify: no console errors, no hydration mismatches
