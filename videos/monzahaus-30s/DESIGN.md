# MonzaHaus — 30s Instagram Promo

A 9:16, 30-second lifestyle film for MonzaHaus. The brand is **museum-quiet**, not race-loud — investment-grade collector energy, not adrenaline. The film shows that owning a Porsche through MonzaHaus is *belonging to a house*, made possible by **cross-continental market intelligence**.

## Format
- 1080 × 1920 (9:16, Instagram Reels)
- 30 seconds total
- 30 fps
- Narrated (TTS, `am_michael` — warm American male, fanatic register)

## Style Prompt
Editorial, museum-grade automotive cinema. Slow, confident motion. Deep burgundy-black canvas with warm rose-gold highlights. Cormorant Garamond serif for display, Karla sans for labels (uppercase, generous tracking). Photographs treated as exhibits, not ads — soft vignettes, subtle film grain. Type enters with patience: long fades, gentle drifts. The viewer should feel they are walking through a private collection at night.

## Colors

| Token | Hex | Use |
|---|---|---|
| Canvas | `#0E0A0C` | Primary background (burgundy-black) |
| Surface | `#161113` | Card / overlay surface |
| Accent rose | `#D4738A` | Highlights, underlines, key reveals |
| Accent burgundy | `#7A2E4A` | Deep moments, secondary type |
| Off-white | `#E8E2DE` | Primary type on dark |
| Cream | `#FDFBF9` | Final CTA reveal canvas |
| Muted | `#9A8E88` | Captions, secondary labels |
| Border | `#2A2226` | Hairlines |

**Banding guard:** never use a full-screen linear dark-to-darker gradient. Use radial rose glow at scene tops + solid canvas elsewhere.

## Typography
- **Display:** Cormorant Garamond (weights 300, 400, 500). Use for headlines, the MonzaHaus mark, narrative captions.
- **Labels:** Karla (weights 400, 600). Use for series codes, year ranges, geo labels. Always `text-transform: uppercase` with `letter-spacing: 0.2em`.
- Numerals: `font-variant-numeric: tabular-nums`.

## Motion Principles
- Default ease: `expo.out` for entrances, `power2.inOut` for cross-dissolves, `power3.in` only on the final fade.
- Default duration: 0.8–1.4s for entrances. Holds are long (1.5–3s on hero photos).
- Stagger: 100–180ms — never machine-gun fast.
- Image entrances: scale 1.04 → 1.0 with opacity 0 → 1, slight `blur(4px) → blur(0)` (8% perf cost OK on a 30s render).
- Type entrances: y +24 → 0 with opacity 0 → 1, plus `letter-spacing` from `0.4em → 0.2em` for an unfurling feel on display text.
- Transitions between scenes: cross-dissolve (0.6s) — never hard cuts.

## What NOT to Do
- ❌ No racing-red `#FF0000`, no checkered flags, no "speed" tropes
- ❌ No drum-heavy or kinetic chaos animations — this is editorial, not advertising
- ❌ No neon, no cyber, no gradient text rainbows
- ❌ No photo borders, drop shadows on photos, or "card stack" treatments
- ❌ No abbreviations in narration ("we read every market", not "we scan every mkt")
- ❌ No exit animations on intermediate scenes — transitions handle scene exits

## Narration

| # | Time (in/out) | Voice cue | Line |
|---|---|---|---|
| 1 | 0.5 → 3.5 | Reverent, almost a whisper | "A Porsche — a real one — is never just yours." |
| 2 | 4.0 → 8.5 | Quietly building | "Every generation carries the one before it." |
| 3 | 9.0 → 16.5 | Confident, knowing | "We read every market. Japan. The UK. Europe. The States. Every auction — every signal." |
| 4 | 17.0 → 22.5 | Settled conviction | "So when you move on one, you move with conviction. Not luck." |
| 5 | 23.5 → 28.5 | Warm, declarative | "MonzaHaus. The house Porsche built you into." |

Voice: Kokoro `am_michael`. If the voice reads too casual, fall back to `bm_george` (UK refined).

## Beat Map

| t (s) | Beat | Visual | Audio |
|---|---|---|---|
| 0.0–3.5 | **Cold open** | Single 930 Turbo detail shot, slow zoom-in (1.04→1.0). Title card not shown. | Narration 1 |
| 3.5–9.0 | **Lineage** | 4 hero cars (930 → 993 → 991 GT3 RS → 992) cross-dissolve. Each holds 1.2s, dissolve 0.4s. Series code overlays bottom-left in Karla. | Narration 2 |
| 9.0–17.0 | **Intelligence / continents** | Dark map of world (SVG). Tokyo → London → Stuttgart → Monterey light up rose. Under each, one listing card slides in (image + price + currency code). | Narration 3 |
| 17.0–23.0 | **Conviction / details** | 3 detail close-ups (gauge cluster, leather stitch, key/door handle) cross-dissolve. Slow pan within each (5px translate over 2s). | Narration 4 |
| 23.0–30.0 | **House reveal + CTA** | Canvas crossfades to cream. "MONZAHAUS" rises in Cormorant 280px. Tagline below. Rose underline draws across at t=27s. | Narration 5 |

## Sources
- Photos: Supabase `listings` table → downloaded to `assets/photos/` via `scripts/fetch-monzahaus-photos.ts`
- Brand tokens: extracted from `src/app/globals.css` (Salon palette)
- Series taxonomy: `src/lib/brandConfig.ts`
