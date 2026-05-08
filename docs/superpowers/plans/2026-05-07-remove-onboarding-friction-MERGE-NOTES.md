# Remove Onboarding Friction — Merge Notes

**Branch:** `remove-onboarding-friction`
**Base:** `main` (at SHA `42400d0`).
**Status:** Ready to merge. Pushed to `origin/remove-onboarding-friction`. PR not opened.

---

## TL;DR

The 4-step `OnboardingModal` that fired after first sign-in is gone. New users land directly on the home/browse view with no overlay, no questions, no friction. Pure removal: 652 lines deleted, 0 added.

**Recommended merge:** `Create a merge commit` or `Rebase and merge`. Single commit on the branch, so squash is also fine here.

---

## Why we removed it

The modal asked four things; only one had downstream use, and that one is recoverable from a single click in the existing Header.

| Step | Asked for | What the codebase did with the answer |
|---|---|---|
| 1. Region | `US / UK / EU / JP / Other` | Initialized `RegionContext.selectedRegion`. The user can change this any time from the Header pills — not worth a modal. |
| 2. Brands | Non-Porsche marques | **Saved to `localStorage`. No component reads it.** Dead capture. The product is Porsche-only by decision. |
| 3. Models | Porsche series | **Saved to `localStorage`. No component reads it.** Dead capture. |
| 4. Intent | `buy / sell / track / learn` | **Saved to `localStorage`. No component queries it anywhere.** Pure analytics theater without analytics. |

Net effect of the modal was that 100% of new sign-ins paid friction for ~zero product value.

---

## Commits (1)

| SHA | Subject |
|---|---|
| `2d19b07` | feat(onboarding): remove first-sign-in modal — pure friction |

---

## Files changed

### Deleted
- `src/components/onboarding/OnboardingModal.tsx` — the 4-step modal component.
- `src/lib/onboardingPreferences.ts` — the `localStorage` helper for the (now unused) captured data.

### Modified
- `src/app/[locale]/layout.tsx` — removed the `<OnboardingModal />` mount and its import.
- `messages/en.json` · `messages/es.json` · `messages/de.json` · `messages/ja.json` — surgical delete of the `onboarding` namespace (27 strings × 4 locales = 108 lines). Rest of each file is byte-identical (used `sed` with line-range pattern, then validated `JSON.parse()`).

### Out of scope — explicitly NOT touched
- `src/lib/RegionContext.tsx` — unchanged. The context still exists and powers the global Header region pills.
- Any backend, API route, scraper, or migration.

---

## QA verification (executed before push)

- `npx eslint src/app/[locale]/layout.tsx` → 0 errors.
- `npx tsc --noEmit` → 0 errors in touched files; 63 pre-existing errors elsewhere are identical to `main`'s baseline.
- `npm run dev` → server boots cleanly. `GET /` and `GET /browse` return 200 OK.
- Manual smoke in Chrome at viewport 1440×900:
  - `http://localhost:3000/en` redirects to `/browse`.
  - No modal overlay anywhere on the page.
  - No "Where do you collect?" or "Beyond Porsche" text in the rendered HTML.
  - The Header region pills still work normally; clicking them updates `RegionContext` and (when on `/browse`) the URL.

---

## How to merge

```bash
git fetch origin
git checkout remove-onboarding-friction
npm install   # not strictly needed — no deps changed
npm run build
```

If the build succeeds, open the PR:

```bash
gh pr create \
  --base main \
  --head remove-onboarding-friction \
  --title "feat(onboarding): remove first-sign-in modal" \
  --body-file docs/superpowers/plans/2026-05-07-remove-onboarding-friction-MERGE-NOTES.md
```

### Post-merge — verify in production

1. Sign out of the production app.
2. Sign up with a fresh email (or an existing account whose `localStorage` was cleared).
3. After confirming the email and landing inside, **no modal should appear**. The user goes straight to whatever home/landing route is configured.

---

## What we didn't break

- The `RegionContext` provider stays in `layout.tsx`. Nothing reads `onboardingPreferences` anymore, but `selectedRegion` is still respected globally and is still settable from the Header.
- Existing users who completed onboarding before this change: their localStorage entry simply becomes inert. No migration needed.
- i18n: the four locale files remain valid JSON; no other namespace was touched.

---

*End of merge notes.*
