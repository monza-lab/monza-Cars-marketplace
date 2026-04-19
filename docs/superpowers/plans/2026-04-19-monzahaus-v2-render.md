# MonzaHaus 30s — v2 Render Plan

**Date:** 2026-04-19
**Based on:** v1 draft at `videos/monzahaus-30s/renders/monzahaus-30s-draft.mp4`
**Goal:** Address three specific user corrections before re-rendering.

## The three corrections

1. **Photos must come from Elferspot only** (highest-quality source in the marketplace).
2. **Transitions are too slow.** The only pacing the user liked is the **family sequence in the "Lineage" scene** (4 cars crossfading every ~1.25s). Every other scene feels too held. Solution: apply that rhythm everywhere, and put **more families** into lineage so the transitions keep coming.
3. **The hook needs to be rebuilt** based on what actually works on TikTok/Reels for car creators.

The rest of the DESIGN.md (editorial burgundy-black palette, Cormorant + Karla typography, warm tints, grain, finale treatment) stays.

---

## Correction 1 — Elferspot-only photo pipeline

### Current state

The v1 render mixes 5 sources (Elferspot, AutoScout24, BeForward, AutoTrader, ClassicCom). Of the 18 photos in `assets/photo-manifest.json`, **only 7 are from Elferspot** — most of the hero frames in lineage/continents/details are from other marketplaces.

### Supabase inventory (confirmed 2026-04-19)

Elferspot Porsche listings with ≥5 photos, by generation:

| Series | Elferspot listings (≥5 photos) |
|---|---|
| 992 | 585 |
| 991 | 394 |
| 997 | 349 |
| 930 | 341 |
| 964 | 246 |
| 718 | 198 |
| 993 | 191 |
| 996 | 160 |
| 356 | 132 |
| Carrera GT | 9 |
| 918 | 3 |
| 959 | 2 |

Elferspot Porsche listings with ≥8 photos, by country:

| Country | Rich listings |
|---|---|
| Germany | 972 |
| Netherlands | 408 |
| Belgium | 349 |
| USA | 320 |
| France | 276 |
| Italy | 125 |
| UK | 112 |
| Austria | 94 |
| Denmark | 85 |
| Switzerland | 82 |
| Sweden | 63 |
| Spain | 40 |

**Consequence for the "Continents" scene:** Elferspot has **zero Japan listings**. The current Tokyo/London/Stuttgart/Monterey framing can't be sourced from Elferspot. See Correction 2 for the reframe.

### Action

Rewrite `scripts/fetch-monzahaus-photos.ts` to filter `source = 'Elferspot'` on every query, delete the existing `assets/photos/` and `assets/photo-manifest.json`, then re-fetch.

Changes to the script:
- Every Supabase query adds `.eq('source', 'Elferspot')`
- `lineageTargets` expands from 4 generations (930/993/991/992) to **8** (356/930/964/993/996/997/991/992 — see Correction 2)
- `continents` list replaced with Euro-centric buckets that Elferspot actually covers: Germany, Netherlands, Italy, France, UK, Belgium (plus USA as the non-Euro anchor)
- `queryByCountry` drops Japan entirely; adds Belgium, Netherlands, Italy, France
- Detail shots: pull only from Elferspot listings with ≥10 photos; prefer models with rich interior/exterior coverage (Carrera GT, 918, 959 — all have Elferspot stock, albeit small)
- Enforce quality: reject photos smaller than 200 KB (Elferspot originals are typically 500 KB–2 MB; tiny files are usually thumbnails)

---

## Correction 2 — Pacing: more families, tighter holds

### The rhythm the user liked

The lineage scene at `videos/monzahaus-30s/compositions/lineage.html` crossfades 4 family photos at these offsets: `0 → 1.2s → 2.45s → 3.7s`. Each family holds for ~1.25s with a 0.5s crossfade. That cadence is **≈0.8s per beat** when you count the crossfade as part of the next beat. This is what we apply everywhere.

### v2 scene map (30s total)

| Scene | v1 duration | v2 duration | What changes |
|---|---|---|---|
| Hook | 3.5s | **2.5s** | See Correction 3. Car in view by t=0.3s, not t=3.5s. |
| Lineage | 5.5s | **7.0s** | 8 families instead of 4. Each holds ~0.85s. |
| Markets (née Continents) | 8.0s | **7.5s** | Sequential flash-cards, 6 markets, not a 2×2 grid. Each ~1.1s. |
| Conviction | 6.0s | **5.0s** | 5 detail photos, ~0.9s each, instead of 3 at ~2s each. |
| Finale | 7.0s | **8.0s** | Slightly longer — the brand mark and CTA deserve to breathe. |

Total: 2.5 + 7.0 + 7.5 + 5.0 + 8.0 = **30.0s** ✓

### Lineage v2 — 8 families

Each family holds ~0.85s, crossfade 0.35s. Family badges use the same Cormorant 200px code + Karla year-range treatment that already worked.

| # | Series | Badge | Year range | Source hint |
|---|---|---|---|---|
| 1 | 356 | `356` | 1948 — 1965 | Elferspot 132 rich |
| 2 | 930 | `930` | 1975 — 1989 | Elferspot 341 rich |
| 3 | 964 | `964` | 1989 — 1994 | Elferspot 246 rich |
| 4 | 993 | `993` | 1993 — 1998 | Elferspot 191 rich |
| 5 | 996 | `996` | 1997 — 2005 | Elferspot 160 rich |
| 6 | 997 | `997` | 2004 — 2012 | Elferspot 349 rich |
| 7 | 991 | `991` | 2011 — 2019 | Elferspot 394 rich |
| 8 | 992 | `992` | 2018 — now | Elferspot 585 rich |

Timing (scene-relative, 0–7.0s):

```
Family 1 enters  0.00s  holds until  0.85s  (crossfade 0.85→1.20)
Family 2 enters  0.85s  holds until  1.70s
Family 3 enters  1.70s  holds until  2.55s
Family 4 enters  2.55s  holds until  3.40s
Family 5 enters  3.40s  holds until  4.25s
Family 6 enters  4.25s  holds until  5.10s
Family 7 enters  5.10s  holds until  5.95s
Family 8 enters  5.95s  holds until  7.00s  (last family holds slightly longer)
```

The badge itself uses a 0.35s `expo.out` entrance — that's identical to v1 so the "feel" the user liked is preserved, just repeated twice as often.

### Markets v2 — reframed around what Elferspot covers

Drop the 2×2 grid. Replace with **6 sequential flash-cards**, each a full-frame photo with a bottom-left market label + price. This matches the lineage cadence.

| Order | Market | Elferspot supply |
|---|---|---|
| 1 | Stuttgart, Germany | 972 |
| 2 | Amsterdam, Netherlands | 408 |
| 3 | Antwerp, Belgium | 349 |
| 4 | Milan, Italy | 125 |
| 5 | London, United Kingdom | 112 |
| 6 | Monterey, USA | 320 |

Narration rewrite (was: "We read every market. Japan. The UK. Europe. The States."):

> "Every market. Germany. Benelux. Italy. Britain. The States. Every auction, every signal."

6 markets × 1.1s each = 6.6s, plus 0.9s intro/outro = 7.5s. Same expo.out entrance pattern as v1 quadrants, but serialised so transitions keep firing.

### Conviction v2

5 detail photos @ ~0.9s each (was 3 @ ~2s). "By conviction." word reveal lands at 1.5s instead of 2.2s so it enters during the rhythm, not after it.

### Hook v2

See Correction 3 — only 2.5s, car dominant, text short.

### Finale v2

No pacing change except a +1s extension so the CTA holds long enough to read. Same animation sequence.

---

## Correction 3 — The hook, based on TikTok car-creator research

### What the research said

Pulled `/last30days` on car-content hooks across TikTok, Reddit, X. The highest-engagement posts in the last 30 days:

| Creator | Views / likes | Caption/hook |
|---|---|---|
| @moreclixtv | 454K / 45K | "My new SF90 Spider 🔥" |
| @mr.jet._ | 340K / 43K | "FOLLOW to see more supercars except this video isn't about cars 😉 The send at the end 😮‍💨" |
| @colby_cars | 280K / 55K | "McLaren 😍" |
| @acarfilmer | 131K / 26K | "Porsche gt3rs 😍" |
| @minh.c.1976 | 1.07M / 46K | "Mercedes..🔥" |

Web-search supplement confirmed the framework:
- First 3 seconds determine survival; strong hooks see **30–40% higher completion rates** (sendshort.ai)
- On-screen bold text is essential because most TikTok viewers are muted (HeyOrca)
- Top working hook types: curiosity loops, contrarian statements, ownership reveals, direct visuals

### What this means for our hook

The v1 hook — "A Porsche — a real one — is never just yours." in 84px italic Cormorant with a 3.5s slow zoom — is **the opposite** of what performs. It's literary narration, the car doesn't dominate, and the text is serif italic (hard to read muted, at 9:16 on a phone). A TikTok viewer scrolls at 1.2s.

### v2 hook design

**Duration:** 2.5s (was 3.5s).

**Visual:** A single hero Porsche photo from Elferspot, full frame, sharp (no blur-in). The user's prior 930 Turbo from `lineage_930_66f25da8.webp` is from AutoScout24 — swap for an Elferspot-sourced 992 GT3 RS or 993 Turbo (highest-engagement generations per r/Porsche).

**Text — two-line on-screen headline, bold Karla, 110px, all-caps, centered lower-third:**

```
Line A (0.25–1.0s):  EVERY PORSCHE HAS A PRICE.
Line B (1.0–2.5s):   NOT EVERY PORSCHE IS WORTH IT.
```

This is a **contrarian/curiosity hook** (per the research): the first line sets up a universal statement, the second line flips it — the viewer is now wondering "which one is worth it?" and the lineage scene immediately delivers 8 candidates.

**Alternative hook variants** (A/B candidates — pick one before render):

| # | Line A | Line B | Hook type | Why it's on the list |
|---|---|---|---|---|
| V1 | EVERY PORSCHE HAS A PRICE. | NOT EVERY PORSCHE IS WORTH IT. | Contrarian | Sets up the entire lineage scene. Recommended default. |
| V2 | 914 PORSCHES ARE FOR SALE RIGHT NOW. | ONLY 3% WILL HOLD THEIR VALUE. | Stat/pain | Uses our actual listing count. Specific numbers → credibility. |
| V3 | MOST PEOPLE BUY A PORSCHE. | WE FIND YOU THE ONE THAT BUYS YOU BACK. | Contrarian/brand | Closer to MonzaHaus's investment-grade positioning. |
| V4 | FOLLOW TO SEE THE ONE PORSCHE | WE'D ACTUALLY BUY RIGHT NOW. | Follow-prompt | Mirrors @mr.jet._'s 340K-view pattern literally. |

**Recommendation:** ship V1 as the default; keep V3 and V4 as alternates we can render variants of (cheap — only the hook composition changes).

**Narration:** replace the 3s whispered line with a **2.2s spoken beat** on the same Kokoro `am_michael` voice, reading whichever variant we pick. Softer and slower than the text on screen (text is the attention grab, voice is the confirmation).

**Motion:** the car photo enters with a tight `scale 1.08 → 1.00` over the full 2.5s (not a filter-blur ramp — blur is the thing that cost us 1s of dead time in v1). Line A slides up `y +30 → 0, opacity 0 → 1` over 0.45s at t=0.25. Line B replaces Line A with a clip-path wipe from left at t=1.0s (v1 had no kinetic text — adding one moment of kinetic type primes the viewer for the lineage rhythm that follows).

---

## Implementation order

1. **Modify `scripts/fetch-monzahaus-photos.ts`** to filter Elferspot and expand targets. Re-run. Verify manifest has 8 lineage entries × 2 photos each, 6 markets × 2, 6 details.
2. **Rewrite `compositions/cold-open.html`** with v2 hook (text-forward, 2.5s). Build layout static first per hyperframes skill "Layout Before Animation" rule.
3. **Rewrite `compositions/lineage.html`** for 8 families at 0.85s each. Reuse existing badge CSS; just extend the timeline with 4 more beats.
4. **Rewrite `compositions/continents.html`** (rename to `markets.html` or keep name) for 6 sequential flash-cards.
5. **Update `compositions/conviction.html`** for 5 details × 0.9s.
6. **Extend `compositions/finale.html`** by +1s.
7. **Update narration audio**: regenerate `assets/audio/phrase-1.wav` (new hook line) and `phrase-3.wav` (new markets line). Keep phrases 2, 4, 5.
8. **Update root `index.html`** with new `data-start` / `data-duration` values per the scene map.
9. **Lint + validate**: `npx hyperframes lint` and `npx hyperframes validate` per skill checklist.
10. **Render** to `renders/monzahaus-30s-v2.mp4`. Keep v1 draft for comparison.

## Open questions before implementation

1. Which hook variant (V1/V2/V3/V4) should we render first?
2. Do we keep 356 in the lineage? It's pre-911 and breaks the "911 generations" narrative — but it's the most historically weighty Porsche and Elferspot has 132 rich listings. Tradeoff: authority vs. narrative coherence.
3. The 918 Spyder only has 3 Elferspot listings with 5+ photos. Do we include it in "conviction" details, or stick to Carrera GT (9 listings) and 959 (2)?
4. Currency codes in the markets scene: v1 showed ¥/£/€/$. With Japan gone, should we show only € (for Europe) + £ (UK) + $ (USA)?
