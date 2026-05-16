# Feedback Amigo Cami — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply frontend feedback from Cami's friend (a heavy collector-car browser) to the Aura-Maxima build: better light-theme contrast, fewer clicks from dashboard to cars, watchlist feature, and a redesigned magic-link confirmation screen — all frontend-only, no backend changes.

**Architecture:** All changes stay inside `src/` and `messages/`. No DB schema, no API routes, no Supabase config changes. Watchlist persistence uses `localStorage` (frontend-only). Email-template work is **out of scope** — captured in a handoff doc for Cami.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · next-intl · lucide-react · Supabase Auth (read-only consumption — we don't touch Auth config)

**Out of scope (per Edgar):**
- Task 4 of feedback: Landing page tipo Elferspot — **NOT THIS PLAN**.
- Email template (the actual email body that lands in user's inbox) — backend, captured in handoff doc.

**Branch:** `feedback-amigo-cami` (already created off `Aura-Maxima-Front`).

---

## Source of Feedback

Transcription file (whisper, Spanish): `/tmp/feedback-cami-transcript/feedback-cami-audio.txt`

The 5 points distilled:

| # | Point | In this plan |
|---|---|---|
| 1 | Contrast — grays too close to white, hard to read numbers/text | ✅ Task 2 |
| 2 | Too many clicks dashboard → cars (sidebar should show cars directly) | ✅ Task 3 |
| 3 | Watchlist feature (favorite cars, see list) | ✅ Task 4 |
| 4 | Landing tipo Elferspot for MonzaHaus | ❌ Excluded by Edgar |
| 5 | Magic link confirmation screen doesn't look good | ✅ Task 1 |

Cami also says the email itself looks horrible. That's a Supabase Auth template — backend. Captured in Task 5 handoff doc.

---

## File Structure

### Files Modified

| Path | Responsibility |
|---|---|
| `src/components/auth/AuthModal.tsx` | Replace hardcoded "Check your inbox" block (lines 171-191) with redesigned confirmation screen using new i18n keys |
| `src/app/globals.css` | Bump `--muted-foreground` (light only) from `#9A8E88` → `#6B6365` for WCAG AA pass; verify other light-mode token contrasts |
| `messages/en.json` | Add 6 new keys under `auth` namespace for confirmation screen |
| `messages/es.json` | Same keys, translated |
| `messages/de.json` | Same keys, translated |
| `messages/ja.json` | Same keys, translated |
| `src/components/dashboard/DashboardClient.tsx` | Verify/adjust family-click flow to skip intermediate generations view |
| `src/components/dashboard/sidebar/DiscoverySidebar.tsx` | Family items in sidebar route directly to cars view |
| `src/components/layout/Header.tsx` | Add Watchlist nav link with badge count |

### Files Created

| Path | Responsibility |
|---|---|
| `src/hooks/useWatchlist.ts` | localStorage-backed hook: `{ ids, add(id), remove(id), toggle(id), has(id), clear() }` |
| `src/hooks/useWatchlist.test.ts` | Vitest unit tests for the hook |
| `src/components/cars/WatchButton.tsx` | Heart-icon toggle button used inside car cards |
| `src/app/[locale]/watchlist/page.tsx` | `/watchlist` route — grid of watchlisted cars pulled from localStorage |
| `docs/handoff-cami-feedback.md` | What was done (frontend) + what's left for Cami (backend: Supabase email template) |

### Files Investigated (no modifications expected)

| Path | Why |
|---|---|
| `src/components/makePage/CarFeedCard.tsx` / `CarCard.tsx` | Inject `<WatchButton />` per card |
| `src/components/auction/AuctionCard.tsx` | Maybe inject `<WatchButton />` for consistency |
| `src/features/social-engine/styles/brand-tokens.css` | Verify no light-mode contrast issues here too |

---

## Task 1: Redesign Magic Link Confirmation Screen

**Why first:** Smallest, most localized change. Edgar sees result fastest. Cami explicitly asked for HTML/styling. WCAG-friendly by design.

**Files:**
- Modify: `src/components/auth/AuthModal.tsx:171-191`
- Modify: `messages/en.json`, `messages/es.json`, `messages/de.json`, `messages/ja.json` (add keys under `auth`)

### Design intent

A clear post-action confirmation card with:
1. **Icon** (Mail from lucide-react) inside a soft lavender circle — premium feel, single visual anchor
2. **Title** "Check your inbox" — display font, 18px+ for WCAG large-text
3. **Body** "We sent a one-tap sign-in link to **email@example.com**" — email visually highlighted
4. **Secondary copy** "It usually arrives in under a minute. Don't forget to check spam."
5. **Action 1** Primary button "Resend email" — **always visible** (today only on signupConfirmation)
6. **Action 2** Link "Try a different email" — resets state to form

### Steps

- [ ] **Step 1: Add i18n keys to `messages/en.json`**

Find the `"auth": { ... }` block. Add these keys (insert after `magicLinkSent`):

```json
    "magicLinkSentTitle": "Check your inbox",
    "magicLinkSentBody": "We sent a one-tap sign-in link to",
    "magicLinkSentHint": "It usually arrives in under a minute. Don't forget to check spam.",
    "magicLinkResend": "Resend email",
    "magicLinkResendCooldown": "Sent — try again in {seconds}s",
    "magicLinkTryAnother": "Try a different email"
```

- [ ] **Step 2: Add same keys to `messages/es.json`**

```json
    "magicLinkSentTitle": "Revisa tu correo",
    "magicLinkSentBody": "Te enviamos un enlace de acceso de un solo toque a",
    "magicLinkSentHint": "Suele llegar en menos de un minuto. No olvides revisar spam.",
    "magicLinkResend": "Reenviar correo",
    "magicLinkResendCooldown": "Enviado — intenta de nuevo en {seconds}s",
    "magicLinkTryAnother": "Probar con otro correo"
```

- [ ] **Step 3: Add same keys to `messages/de.json`**

```json
    "magicLinkSentTitle": "Sieh in deinem Posteingang nach",
    "magicLinkSentBody": "Wir haben dir einen One-Tap-Anmeldelink gesendet an",
    "magicLinkSentHint": "Der Link kommt meist in weniger als einer Minute. Prüfe auch den Spam-Ordner.",
    "magicLinkResend": "E-Mail erneut senden",
    "magicLinkResendCooldown": "Gesendet — erneut versuchen in {seconds}s",
    "magicLinkTryAnother": "Andere E-Mail verwenden"
```

- [ ] **Step 4: Add same keys to `messages/ja.json`**

```json
    "magicLinkSentTitle": "受信トレイをご確認ください",
    "magicLinkSentBody": "ワンタップサインインリンクを以下に送信しました",
    "magicLinkSentHint": "通常1分以内に届きます。迷惑メールフォルダもご確認ください。",
    "magicLinkResend": "メールを再送信",
    "magicLinkResendCooldown": "送信済み — {seconds}秒後に再試行",
    "magicLinkTryAnother": "別のメールアドレスを使用"
```

- [ ] **Step 5: Import Mail icon in `AuthModal.tsx`**

In `src/components/auth/AuthModal.tsx`, find the import line for lucide-react (line 12):

```tsx
import { Loader2, ChevronDown } from 'lucide-react'
```

Change to:

```tsx
import { Loader2, ChevronDown, Mail } from 'lucide-react'
```

- [ ] **Step 6: Add cooldown state for Resend button**

In `AuthModal.tsx`, near other useState declarations (around line 30), add:

```tsx
const [resendCooldown, setResendCooldown] = useState(0)
```

Below the existing `useEffect` that resets state when modal toggles (around line 51), add a new effect for the cooldown countdown:

```tsx
// Countdown for resend cooldown
useEffect(() => {
  if (resendCooldown <= 0) return
  const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000)
  return () => clearTimeout(t)
}, [resendCooldown])
```

Also extend the reset effect (currently lines 41-51) to clear cooldown when modal closes:

```tsx
useEffect(() => {
  if (!open) {
    setMagicSent(false)
    setSignupConfirmation(false)
    setError(null)
    setShowPassword(false)
    setLoading(null)
    setResendCooldown(0)
  } else {
    setMode(defaultMode)
  }
}, [open, defaultMode])
```

- [ ] **Step 7: Add resend-magic and try-another handlers**

In `AuthModal.tsx`, right after the existing `handleResendConfirmation` function (around line 136), add:

```tsx
const handleResendMagic = async () => {
  if (!email || resendCooldown > 0) return
  setLoading('magic')
  setError(null)
  try {
    const { error } = await signInWithMagicLink(email)
    if (error) {
      setError(error.message)
    } else {
      setResendCooldown(30)
    }
  } catch {
    setError(t('unexpectedError'))
  } finally {
    setLoading(null)
  }
}

const handleTryAnother = () => {
  setMagicSent(false)
  setSignupConfirmation(false)
  setError(null)
  setResendCooldown(0)
}
```

- [ ] **Step 8: Replace the confirmation screen block**

In `AuthModal.tsx`, find the existing confirmation block (lines 171-191):

```tsx
{(magicSent || signupConfirmation) ? (
  <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-5 text-center">
    <p className="text-[14px] font-semibold text-foreground">
      {/* [HARDCODED] */}Check your inbox
    </p>
    <p className="mt-1.5 text-[12px] text-muted-foreground">
      {/* [HARDCODED] */}We sent a one-tap link to
      <br />
      <span className="text-foreground font-medium">{email}</span>
    </p>
    {signupConfirmation && (
      <button
        type="button"
        onClick={handleResendConfirmation}
        disabled={loading === 'magic'}
        className="mt-3 text-[11px] text-muted-foreground hover:text-primary underline underline-offset-2"
      >
        {t('resendConfirmation')}
      </button>
    )}
  </div>
) : (
```

Replace it with:

```tsx
{(magicSent || signupConfirmation) ? (
  <div className="flex flex-col items-center text-center py-2">
    {/* Icon */}
    <div className="size-14 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center mb-4">
      <Mail className="size-6 text-primary-foreground" strokeWidth={1.75} />
    </div>

    {/* Title */}
    <h3 className="font-display text-[20px] sm:text-[22px] leading-tight font-medium text-foreground">
      {t('magicLinkSentTitle')}
    </h3>

    {/* Body with email highlighted */}
    <p className="mt-2 text-[13px] text-muted-foreground max-w-[300px]">
      {t('magicLinkSentBody')}
      <br />
      <span className="text-foreground font-medium break-all">{email}</span>
    </p>

    {/* Secondary hint */}
    <p className="mt-3 text-[11.5px] text-muted-foreground/85 max-w-[280px] leading-relaxed">
      {t('magicLinkSentHint')}
    </p>

    {/* Actions */}
    <div className="mt-5 w-full flex flex-col gap-2">
      <button
        type="button"
        onClick={signupConfirmation ? handleResendConfirmation : handleResendMagic}
        disabled={loading === 'magic' || resendCooldown > 0}
        className="w-full py-3 rounded-xl bg-foreground/[0.06] border border-border text-foreground text-[13px] font-medium active:bg-foreground/[0.1] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {loading === 'magic' ? (
          <Loader2 className="size-4 animate-spin" />
        ) : null}
        {resendCooldown > 0
          ? t('magicLinkResendCooldown', { seconds: resendCooldown })
          : t('magicLinkResend')}
      </button>
      <button
        type="button"
        onClick={handleTryAnother}
        className="text-[12px] text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground transition-colors py-1"
      >
        {t('magicLinkTryAnother')}
      </button>
    </div>
  </div>
) : (
```

- [ ] **Step 9: Manually verify in browser**

Run dev server (already running on port 3000). Open `http://localhost:3000/en` and trigger the sign-in modal (likely top-right button or `/account`).

1. Enter an email → click "Send Magic Link"
2. Verify the confirmation screen shows:
   - Mail icon in a lavender circle
   - "Check your inbox" title
   - Email highlighted
   - Spam hint
   - "Resend email" button
   - "Try a different email" link
3. Click "Resend email" → button should show "Sent — try again in 30s" and disable
4. Click "Try a different email" → returns to form
5. Switch locale to `/es`, repeat — verify Spanish strings render
6. Light mode: text should be clearly readable (no washed-out grays)

- [ ] **Step 10: Commit**

```bash
git add src/components/auth/AuthModal.tsx messages/en.json messages/es.json messages/de.json messages/ja.json
git commit -m "$(cat <<'EOF'
feat(auth): redesign magic link confirmation screen

- Add Mail icon + lavender circle for visual anchor
- Translate all strings via next-intl (4 locales)
- "Resend email" always available with 30s cooldown
- New "Try a different email" link to reset form
- Spam-folder hint for users who don't see the email

Addresses feedback from Cami's friend.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Fix Light-Theme Contrast

**Why second:** Systemic but localized to one file. Once `--muted-foreground` is bumped, dozens of components inherit the fix.

**Files:**
- Modify: `src/app/globals.css:173` (the `--muted-foreground` value)
- Investigate (no expected modification): `src/features/social-engine/styles/brand-tokens.css`

### The problem

In light mode (`:root`), `globals.css:173` defines:

```css
--muted-foreground: #9A8E88;  /* on --background: #FDFBF9 (cream) */
```

WCAG contrast ratio for `#9A8E88` on `#FDFBF9` is **~2.8 : 1**. WCAG AA requires **4.5 : 1** for normal text. This is why Cami's friend says the grays look washed out.

A second potentially-low-contrast token is `--border: #E8E2DC` on cream — at ~1.13:1 it's intentionally subtle, but text using `border-color` as foreground would fail.

### Steps

- [ ] **Step 1: Verify current state — open light mode in browser**

Visit `http://localhost:3000/en/cars/porsche` (or whichever route has cards). In DevTools console, sample a `.text-muted-foreground` element. Compute contrast with the background — confirm < 4.5:1.

Take a screenshot or note 2-3 specific places where text is hard to read.

- [ ] **Step 2: Update `--muted-foreground` in light mode**

In `src/app/globals.css`, find line 173:

```css
--muted-foreground: #9A8E88;
```

Change to (this is `--stone-dark` from the design tokens, which already exists in the dark-mode section and gives ~5.4 : 1 on cream):

```css
--muted-foreground: #6B6365;
```

Do **not** change the dark-mode `--muted-foreground` (line ~231). It's `#6B6365` on `#0E0E0D` and is fine (~6.8 : 1).

- [ ] **Step 3: Visually re-verify in browser**

Reload `http://localhost:3000/en/cars/porsche`. Same elements you noted in Step 1 should now read crisply.

Check 5 spots across the app for regressions where the new muted gray feels too heavy:
- Header secondary labels
- Card metadata (year, mileage)
- Sidebar series subtitles
- Report page narration
- Form field placeholders

If any place needs muted text *lighter* than `#6B6365`, prefer adding a one-off Tailwind opacity (`text-muted-foreground/70`) over weakening the token globally.

- [ ] **Step 4: Quick scan for hardcoded low-contrast grays**

Run:

```bash
grep -rn "text-\[#" src/components 2>/dev/null | grep -iE "#9A8E88|#B89FBE|#E8E2DC" | head
grep -rn "color:\s*#9" src/components 2>/dev/null | head
```

If matches appear in light-mode contexts, replace the hardcoded gray with `text-muted-foreground` so they pick up the fixed token. If they're scoped to `.dark`, leave them.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "$(cat <<'EOF'
fix(theme): bump light-mode muted-foreground for WCAG AA

Change --muted-foreground from #9A8E88 (~2.8:1) to #6B6365 (~5.4:1)
on the cream background. Dark mode unchanged.

Addresses readability feedback — secondary text and numbers were
washed-out in light theme.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Reduce Clicks Dashboard → Cars

**Why third:** Requires investigation. The CLAUDE.md says the flow is already supposed to skip the generations view. Need to confirm what's actually happening today.

**Files:**
- Investigate first, then modify:
  - `src/components/dashboard/DashboardClient.tsx`
  - `src/components/dashboard/sidebar/DiscoverySidebar.tsx`
  - Possibly `src/app/[locale]/cars/[make]/page.tsx` and the `MakePageClient`

### Steps

- [ ] **Step 1: Reproduce the current flow**

In the browser:
1. Go to `http://localhost:3000/en`
2. Click on family `992` (or any series).
3. Note: does it land directly on cars view, or is there an intermediate generations/variants view requiring another click?

Document the exact navigation in 3-5 lines (what was clicked, what page rendered, URL changes).

- [ ] **Step 2: Trace the click handler**

In `DashboardClient.tsx`, find the family card click handler. Trace where it routes. Likely:
- Routes to `/cars/porsche?family=992`
- That hits `MakePageClient` which has a `viewMode` state machine.

Check whether `viewMode` defaults to `'cars'` when `family` is in URL, or whether it starts at `'generations'` and requires another click.

- [ ] **Step 3: Identify the extra click**

Likely sources:
- (a) MakePageClient starts at `viewMode: 'generations'` and shows a "Pick a generation" screen before the cars grid.
- (b) Sidebar items navigate to a `/family/<id>` route that shows the generation list.
- (c) Family card on dashboard opens an expansion drawer instead of routing.

Pinpoint which case applies — write the file:line of the friction.

- [ ] **Step 4: Apply the minimal fix**

Three possible fixes depending on Step 3:

**(a)** If `MakePageClient` defaults to generations: change init to `viewMode: 'cars'` when `searchParams.family` is set. Keep generations view reachable via a "Choose generation" button in the cars view header (don't remove it).

**(b)** If sidebar routes to wrong page: change the `<Link href={...}>` to route to the cars query (`/cars/porsche?family=992`).

**(c)** If family card opens a drawer: change `onClick` to route instead, or hoist the "View cars" action to be the primary CTA on the card.

Whichever applies, the diff should be small (≤ 20 lines).

- [ ] **Step 5: Verify in browser**

Repeat the flow from Step 1. The "Generations" intermediate view should now be **skipped by default** — click `992` → immediately see Porsche 992 cars.

Verify nothing breaks:
- Direct URL like `/cars/porsche?family=992` still works
- Going back to dashboard works
- Other families still navigate correctly

- [ ] **Step 6: Commit**

```bash
git add <files modified>
git commit -m "$(cat <<'EOF'
ux(dashboard): route family click straight to cars view

Removed intermediate "pick a generation" step — clicking a family
on the dashboard or sidebar now lands directly on the cars grid for
that family. Generation switcher remains accessible from the cars
view header.

Addresses feedback: too many clicks to reach the cars.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Watchlist Feature (sidebar tabs, localStorage)

**Why fourth:** Larger surface (new hook, new component, sidebar refactor). Built last because it touches the cards we may have modified in Task 3.

**Decision (validated with Edgar 2026-05-16):**
Watchlist lives in the **bottom section of the left sidebar** (the same space currently occupied by "Live" auctions), as a **tab toggle** between `Watchlist` and `Live`. **No `/watchlist` route, no Header badge.** Default tab: `Watchlist` if user has saved items, otherwise `Live`.

**Files:**
- Create: `src/hooks/useWatchlist.ts`
- Create: `src/hooks/useWatchlist.test.ts`
- Create: `src/components/cars/WatchButton.tsx`
- Create: `src/components/dashboard/sidebar/SidebarBottomTabs.tsx` (new wrapper that renders the tab UI + delegates body)
- Create: `src/components/dashboard/sidebar/WatchlistSidebarSection.tsx` (the Watchlist tab content — list of items in same visual style as Live)
- Modify: `src/components/dashboard/sidebar/DiscoverySidebar.tsx` (replace the Live section block at lines ~240-330 with `<SidebarBottomTabs>`)
- Modify: `src/components/makePage/CarFeedCard.tsx` (inject `<WatchButton />`)
- Modify: `src/components/makePage/CarCard.tsx` (inject `<WatchButton />`)
- Modify: `src/components/auction/AuctionCard.tsx` (inject `<WatchButton />`)
- Modify: `messages/en.json`, `messages/es.json`, `messages/de.json`, `messages/ja.json`

### Persistence decision

Watchlist persists in `localStorage` under key `monza:watchlist:v1` as a JSON array of car IDs (strings). Frontend-only, no backend. If Cami later wants cross-device sync, he adds a `watchlist` table and we swap the hook implementation.

### Steps

- [ ] **Step 1: Write failing test for `useWatchlist`**

Create `src/hooks/useWatchlist.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWatchlist } from './useWatchlist'

const KEY = 'monza:watchlist:v1'

describe('useWatchlist', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('starts empty', () => {
    const { result } = renderHook(() => useWatchlist())
    expect(result.current.ids).toEqual([])
    expect(result.current.has('car-1')).toBe(false)
  })

  it('adds an id', () => {
    const { result } = renderHook(() => useWatchlist())
    act(() => result.current.add('car-1'))
    expect(result.current.ids).toEqual(['car-1'])
    expect(result.current.has('car-1')).toBe(true)
  })

  it('does not duplicate', () => {
    const { result } = renderHook(() => useWatchlist())
    act(() => result.current.add('car-1'))
    act(() => result.current.add('car-1'))
    expect(result.current.ids).toEqual(['car-1'])
  })

  it('removes an id', () => {
    const { result } = renderHook(() => useWatchlist())
    act(() => result.current.add('car-1'))
    act(() => result.current.add('car-2'))
    act(() => result.current.remove('car-1'))
    expect(result.current.ids).toEqual(['car-2'])
  })

  it('toggle adds when missing, removes when present', () => {
    const { result } = renderHook(() => useWatchlist())
    act(() => result.current.toggle('car-1'))
    expect(result.current.has('car-1')).toBe(true)
    act(() => result.current.toggle('car-1'))
    expect(result.current.has('car-1')).toBe(false)
  })

  it('clear empties the list', () => {
    const { result } = renderHook(() => useWatchlist())
    act(() => result.current.add('car-1'))
    act(() => result.current.add('car-2'))
    act(() => result.current.clear())
    expect(result.current.ids).toEqual([])
  })

  it('persists across mounts via localStorage', () => {
    const first = renderHook(() => useWatchlist())
    act(() => first.result.current.add('car-1'))
    first.unmount()

    const second = renderHook(() => useWatchlist())
    expect(second.result.current.ids).toEqual(['car-1'])
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem(KEY, 'not valid json')
    const { result } = renderHook(() => useWatchlist())
    expect(result.current.ids).toEqual([])
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run src/hooks/useWatchlist.test.ts
```

Expected: FAIL — `Cannot find module './useWatchlist'`

- [ ] **Step 3: Implement `useWatchlist`**

Create `src/hooks/useWatchlist.ts`:

```ts
'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'monza:watchlist:v1'
const EVENT_NAME = 'monza:watchlist:change'

function readStorage(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string')
  } catch {
    return []
  }
}

function writeStorage(ids: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
  } catch {
    // localStorage full or unavailable — silent fallback
  }
}

export function useWatchlist() {
  const [ids, setIds] = useState<string[]>(() => readStorage())

  // Sync across tabs and across multiple useWatchlist() instances in same page
  useEffect(() => {
    const handler = () => setIds(readStorage())
    window.addEventListener('storage', handler)
    window.addEventListener(EVENT_NAME, handler)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener(EVENT_NAME, handler)
    }
  }, [])

  const add = useCallback((id: string) => {
    setIds((current) => {
      if (current.includes(id)) return current
      const next = [...current, id]
      writeStorage(next)
      return next
    })
  }, [])

  const remove = useCallback((id: string) => {
    setIds((current) => {
      if (!current.includes(id)) return current
      const next = current.filter((v) => v !== id)
      writeStorage(next)
      return next
    })
  }, [])

  const toggle = useCallback((id: string) => {
    setIds((current) => {
      const next = current.includes(id) ? current.filter((v) => v !== id) : [...current, id]
      writeStorage(next)
      return next
    })
  }, [])

  const has = useCallback((id: string) => ids.includes(id), [ids])

  const clear = useCallback(() => {
    setIds([])
    writeStorage([])
  }, [])

  return { ids, add, remove, toggle, has, clear }
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
npx vitest run src/hooks/useWatchlist.test.ts
```

Expected: 8 tests PASS.

- [ ] **Step 5: Add i18n keys**

In `messages/en.json`, find a sensible top-level namespace (e.g., create `"watchlist"`):

```json
  "watchlist": {
    "title": "My Watchlist",
    "empty": "No cars saved yet. Tap the heart on any listing to start.",
    "emptyCta": "Browse cars",
    "count": "{count, plural, =0 {No cars} =1 {1 car} other {# cars}}",
    "add": "Add to watchlist",
    "remove": "Remove from watchlist",
    "clearAll": "Clear watchlist"
  }
```

Mirror in `messages/es.json`:

```json
  "watchlist": {
    "title": "Mi Lista",
    "empty": "Aún no has guardado carros. Toca el corazón en cualquier listing para empezar.",
    "emptyCta": "Explorar carros",
    "count": "{count, plural, =0 {Sin carros} =1 {1 carro} other {# carros}}",
    "add": "Agregar a la lista",
    "remove": "Quitar de la lista",
    "clearAll": "Vaciar lista"
  }
```

Mirror in `messages/de.json` (translate):

```json
  "watchlist": {
    "title": "Meine Beobachtungsliste",
    "empty": "Noch keine Fahrzeuge gespeichert. Tippe auf das Herz, um zu starten.",
    "emptyCta": "Fahrzeuge entdecken",
    "count": "{count, plural, =0 {Keine Fahrzeuge} =1 {1 Fahrzeug} other {# Fahrzeuge}}",
    "add": "Zur Beobachtungsliste",
    "remove": "Aus Beobachtungsliste entfernen",
    "clearAll": "Liste leeren"
  }
```

Mirror in `messages/ja.json`:

```json
  "watchlist": {
    "title": "ウォッチリスト",
    "empty": "まだ保存された車はありません。ハートをタップして始めましょう。",
    "emptyCta": "車を探す",
    "count": "{count, plural, =0 {0台} =1 {1台} other {#台}}",
    "add": "ウォッチリストに追加",
    "remove": "ウォッチリストから削除",
    "clearAll": "リストを空にする"
  }
```

- [ ] **Step 6: Create `WatchButton` component**

Create `src/components/cars/WatchButton.tsx`:

```tsx
'use client'

import { Heart } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useWatchlist } from '@/hooks/useWatchlist'

interface WatchButtonProps {
  carId: string
  /** Variant — 'overlay' floats on top of card image; 'inline' sits in card body */
  variant?: 'overlay' | 'inline'
  className?: string
}

export function WatchButton({ carId, variant = 'overlay', className = '' }: WatchButtonProps) {
  const t = useTranslations('watchlist')
  const { has, toggle } = useWatchlist()
  const isWatched = has(carId)

  const base =
    'inline-flex items-center justify-center rounded-full transition-all active:scale-90 ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

  const styles = {
    overlay:
      'size-9 bg-background/85 backdrop-blur-md border border-border/60 ' +
      'hover:bg-background hover:border-border shadow-sm',
    inline: 'size-8 bg-foreground/[0.04] hover:bg-foreground/[0.08]',
  }[variant]

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(carId)
      }}
      aria-label={isWatched ? t('remove') : t('add')}
      aria-pressed={isWatched}
      className={`${base} ${styles} ${className}`}
    >
      <Heart
        className={`size-4 transition-colors ${
          isWatched ? 'fill-primary text-primary' : 'text-foreground/70'
        }`}
        strokeWidth={1.75}
      />
    </button>
  )
}
```

- [ ] **Step 7: Inject `WatchButton` into car cards**

For each of `CarFeedCard.tsx`, `CarCard.tsx`, `AuctionCard.tsx`:

1. Add import: `import { WatchButton } from '@/components/cars/WatchButton'`
2. Find the card's main image wrapper (usually a `<div className="relative ...">` containing an `<Image>` or `<SafeImage>`).
3. Add `<WatchButton carId={car.id} variant="overlay" className="absolute top-3 right-3 z-10" />` inside that wrapper.

Pass the unique car identifier — likely `car.id` or `listing.id`. Check each component's prop shape before plugging in.

- [ ] **Step 8: Create `/watchlist` page**

Create `src/app/[locale]/watchlist/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Heart } from 'lucide-react'
import { useWatchlist } from '@/hooks/useWatchlist'

export default function WatchlistPage() {
  const t = useTranslations('watchlist')
  const { ids, clear } = useWatchlist()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <div className="min-h-screen" />
  }

  return (
    <div className="min-h-screen px-4 sm:px-8 py-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-[28px] sm:text-[32px] font-medium text-foreground">
            {t('title')}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {t('count', { count: ids.length })}
          </p>
        </div>
        {ids.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (confirm(t('clearAll') + '?')) clear()
            }}
            className="text-[12px] text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            {t('clearAll')}
          </button>
        )}
      </div>

      {ids.length === 0 ? (
        <div className="flex flex-col items-center text-center py-20">
          <div className="size-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
            <Heart className="size-7 text-primary-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-[15px] text-foreground max-w-[360px]">{t('empty')}</p>
          <Link
            href="/cars/porsche"
            className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition-opacity"
          >
            {t('emptyCta')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* For v1, render IDs as cards-by-link — full card hydration can come later */}
          {ids.map((id) => (
            <Link
              key={id}
              href={`/cars/porsche/${id}`}
              className="aspect-[4/3] rounded-2xl border border-border bg-card flex items-center justify-center hover:border-foreground/30 transition-colors"
            >
              <span className="text-[12px] text-muted-foreground font-mono">{id}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

> **Note on the empty-state placeholder cards:** The v1 of `/watchlist` shows car IDs only, not full hydrated cards. Fetching all listing data for a watchlist requires either a backend endpoint (`GET /api/listings?ids=...`) or pulling the full listing payload into localStorage alongside the ID. Both are scope expansions — keep this as a placeholder and ship v1.

- [ ] **Step 9: Add Watchlist link to Header**

In `src/components/layout/Header.tsx`, find the nav links section. Add a Watchlist link with a count badge.

Add the import at the top:

```tsx
import { Heart } from 'lucide-react'
import { useWatchlist } from '@/hooks/useWatchlist'
```

Inside the Header component body, near the existing nav items, add:

```tsx
const { ids: watchlistIds } = useWatchlist()
```

Render the nav item (adapt to existing nav styling):

```tsx
<Link
  href="/watchlist"
  className="relative inline-flex items-center gap-1.5 px-3 py-2 text-[13px] text-foreground/80 hover:text-foreground transition-colors"
>
  <Heart className="size-4" strokeWidth={1.75} />
  <span className="hidden sm:inline">{t('watchlist.title')}</span>
  {watchlistIds.length > 0 && (
    <span className="absolute -top-1 -right-1 size-4 rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center justify-center">
      {watchlistIds.length > 9 ? '9+' : watchlistIds.length}
    </span>
  )}
</Link>
```

**Important:** This depends on `Header.tsx` already being a client component (`'use client'`). If it isn't, isolate the Watchlist nav item into a small client component (`HeaderWatchlistLink.tsx`) and import that — don't convert the whole header.

- [ ] **Step 10: Manually verify in browser**

1. Visit `/en/cars/porsche` — every car card should now have a heart in the top-right corner.
2. Click a heart — it should fill in lavender.
3. Refresh the page — the heart stays filled (localStorage persists).
4. The Header should show a `1` badge on the Watchlist icon.
5. Click the Watchlist icon → land on `/en/watchlist` showing 1 card.
6. Switch to `/es/watchlist` → strings appear translated.
7. Empty the list using "Clear watchlist" → empty state appears with CTA.

- [ ] **Step 11: Commit**

```bash
git add src/hooks/useWatchlist.ts src/hooks/useWatchlist.test.ts \
  src/components/cars/WatchButton.tsx src/app/[locale]/watchlist/page.tsx \
  src/components/makePage/CarFeedCard.tsx src/components/makePage/CarCard.tsx \
  src/components/auction/AuctionCard.tsx src/components/layout/Header.tsx \
  messages/en.json messages/es.json messages/de.json messages/ja.json
git commit -m "$(cat <<'EOF'
feat(watchlist): add localStorage-backed favorites

- New useWatchlist hook with add/remove/toggle/has/clear
- WatchButton overlay on car cards (CarFeedCard, CarCard, AuctionCard)
- /watchlist page with empty state and count
- Header nav link with count badge
- Cross-tab sync via storage event
- i18n in en/es/de/ja
- 8 unit tests passing

Addresses feedback: users want to save cars they like.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Handoff Doc for Cami

**Why last:** Captures everything that's out of scope (backend) so nothing falls through the cracks.

**Files:**
- Create: `docs/handoff-cami-feedback.md`

### Steps

- [ ] **Step 1: Create the handoff document**

Create `docs/handoff-cami-feedback.md`:

```markdown
# Handoff — Feedback Amigo de Cami (Frontend → Cami)

**Branch:** `feedback-amigo-cami`
**Date:** 2026-05-16

## What's done (frontend, in this branch)

### 1. Magic link confirmation screen redesigned
- File: `src/components/auth/AuthModal.tsx`
- New i18n keys in `messages/{en,es,de,ja}.json` under `auth`
- Visual: Mail icon + lavender circle, clear title, email highlighted, spam hint
- Functional: Resend button with 30s cooldown (works for both magic-link sign-in and signup confirmation), "Try a different email" link

### 2. Light-theme contrast fixed
- File: `src/app/globals.css`
- `--muted-foreground` in light mode bumped from `#9A8E88` (~2.8:1) to `#6B6365` (~5.4:1) on cream background — passes WCAG AA

### 3. One-click family → cars
- Click on a family on the dashboard or sidebar now lands directly on the cars grid (skipped the intermediate "Generations" step where applicable)

### 4. Watchlist feature (localStorage)
- New `useWatchlist` hook (`src/hooks/useWatchlist.ts`) with full unit tests
- Heart toggle button on every car card
- `/watchlist` page with empty state and clear-all
- Header nav link with count badge
- Cross-tab sync via `storage` event

## What's left for you, Cami (backend)

### A. Magic-link email template
The HTML body of the email that arrives in the user's inbox is a **Supabase Auth email template** — it's not in this repo. To change it:

1. Supabase dashboard → Authentication → Email Templates → Magic Link
2. Replace the default template with brand-matched HTML (lavender accent, Salon typography). I can hand you an HTML mock if you want — just ping me.

### B. Watchlist persistence (only if/when we want cross-device sync)
Today watchlist lives in `localStorage` per browser. If we want users to see the same list on phone and laptop:

1. Create table `user_watchlist (user_id uuid, listing_id text, added_at timestamptz)` with composite PK
2. Add RLS so users can only read/write their own rows
3. Endpoints: `GET /api/watchlist`, `POST /api/watchlist`, `DELETE /api/watchlist/:id`
4. I swap `useWatchlist` internals from `localStorage` to a SWR-backed fetcher — minor frontend change, no API surface change

### C. (Optional) Watchlist page hydration
`/watchlist` v1 renders car IDs as placeholder cards. To show full cards, we need either:
- Backend endpoint `GET /api/listings?ids=...` to batch-fetch listings, or
- Frontend caches full listing JSON in localStorage when added (heavier client storage)

I'd lean toward the backend endpoint when we get to v2 — it's cleaner.

## Out of scope (per Edgar, deferred)

- **Landing page tipo Elferspot** for MonzaHaus (hero + tabs: search / sell / magazin / events / members). Not touched in this branch.

## How to review

```bash
git checkout feedback-amigo-cami
npm run dev
# open http://localhost:3000/en
```

Test paths:
- `/en` — dashboard, click any family → should land on cars view directly
- Auth modal → magic link → verify new confirmation screen
- Light mode anywhere — secondary text should be crisp
- Any car listing card → click heart → visit `/en/watchlist`
```

- [ ] **Step 2: Commit**

```bash
git add docs/handoff-cami-feedback.md
git commit -m "$(cat <<'EOF'
docs: add handoff for feedback-amigo-cami branch

Summary of frontend changes and what's left for Cami on backend
(Supabase email template + future watchlist sync).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification

- [ ] **Step 1: All tests pass**

```bash
npx vitest run
```

Expected: all tests green (especially the new `useWatchlist` tests).

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Dev server compiles cleanly**

In the running dev server's terminal, look for any compile errors after all edits. Resolve any before declaring complete.

- [ ] **Step 4: Visual smoke test**

Run through every modified surface in light AND dark mode:
- `/en` and `/es`
- Auth modal magic link flow
- A cars page (e.g., `/en/cars/porsche?family=992`)
- `/en/watchlist` (empty + with 2-3 items)

Note any visual regressions in the chat for Edgar to review before merging.

- [ ] **Step 5: Push the branch**

```bash
git push -u origin feedback-amigo-cami
```

- [ ] **Step 6: Summarize for Edgar**

Write a short message:
- Commits in this branch (count and headlines)
- What to test first
- Any surprises or open questions
- Recommended next step (PR open, or another iteration on Task 3/4)
