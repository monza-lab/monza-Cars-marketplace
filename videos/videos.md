# Video Learnings — Monza / MonzaHaus

Living notes for every video we build for MonzaHaus. Read this BEFORE starting any new video work on this project. Update it when we learn something new.

Latest good render: `videos/monzahaus-30s/renders/monzahaus-21s-v4.mp4` (silent, 21s, 9:16).

---

## Hard rules — never violate

### 1. Never show a black/empty frame between scenes or beats
**This is still happening in some renders — fix it when you see it, don't ship it.**

At scene-to-scene boundaries AND between beats within a scene, the outgoing visual MUST still be on screen when the incoming one arrives. Causes of the black frame:

- **Sequential fade-out-then-fade-in**: outgoing photo goes to opacity 0 at `t`, incoming photo starts from opacity 0 at `t + gap`. Between the two there's nothing visible.
  Fix: incoming starts at the same `t` as the outgoing's fade-out, with incoming's fade-in duration ≥ outgoing's fade-out duration. They overlap; the incoming reaches full opacity *after* the outgoing is fully transparent.

- **Exit animations before transition**: per the HyperFrames rule, exits are banned except on the final scene — the transition IS the exit. If you have `tl.to(..., { opacity: 0 })` at the end of a scene (not the final), you've emptied the scene before the next one can cover it.

- **Scene boundaries with gaps**: `data-start` + `data-duration` must butt up exactly. If scene 1 is `start=0, duration=2.2` and scene 2 is `start=2.3, duration=...`, there's 100ms of nothing.

- **Entrance animations starting after scene start**: if scene 2 begins at t=2.2 but its first element enters at t=2.35, the first 150ms of scene 2 is empty. Either start entrances at t=0 of the scene, OR have a full-bleed background photo already visible at scene start.

**How to check**: step through the rendered MP4 frame-by-frame at every beat boundary and every scene boundary. If you see a black frame, fix the timing math.

### 2. Brand identity
- Wordmark is TEXT, not an image: Cormorant "Monza" (#E8E2DE) + "Haus" (#D4738A). Never use `public/logo-crema.png` — it's legacy "monza lab" helmet branding, not MonzaHaus.
- Fonts: **Cormorant** (serif, display) + **Karla** (sans, body). NOT "Cormorant Garamond" — that's a different sub-family.
- Palette: `#0E0A0C` canvas, `#E8E2DE` cream, `#D4738A` rose.
- Canonical visual reference: `public/og-image.png`.

### 3. Photos come from Elferspot only
- Supabase filter: `.eq("source", "Elferspot")`. Other sources (AutoScout24, BeForward, AutoTrader, ClassicCom) are lower quality and will get flagged by the user.
- Minimum file size 200KB to reject thumbnails.
- Elferspot has zero Japan listings — don't feature Tokyo in a markets montage.

### 4. Audio is off by default
Do NOT add narration or background music unless the user explicitly asks. TikTok-native = on-screen text does the talking.

---

## Pacing

- **Beat cadence: 0.75–0.80s per transition.** Earlier 0.85–0.95s was "too slow."
- **Total duration: 20–22s** for TikTok Reels. Shorten the video if content doesn't fill the time — don't pad.
- **Scene map that works** (v4):
  - Cold-open (hook): 2.2s
  - Lineage (8 generations): 6.5s — 0.80s beats
  - Markets (6 cards): 5.0s — 0.80s beats
  - Conviction (4 details): 3.3s — 0.75s beats
  - Finale (wordmark): 4.0s

---

## Photo framing in 9:16 portrait

Source photos are typically 3:2 landscape (900–1200px wide). When covering to 1080×1920, we scale up ~3× and crop ~35% off each side horizontally. The full vertical height is preserved.

- `object-fit: cover` + `object-position: center 45%` (slight upward bias).
- Ken Burns push-in: `scale 1.04 → 1.00` over the beat duration — subtle, don't zoom aggressively.
- Vignette must be light. Heavy top/bottom darkening makes frames look empty even though the car is present. Current CSS pattern:
  ```css
  background:
    radial-gradient(ellipse at center, transparent 48%, rgba(14,10,12,0.35) 82%, rgba(14,10,12,0.80) 100%),
    linear-gradient(to top, rgba(14,10,12,0.78) 0%, rgba(14,10,12,0.20) 30%, transparent 48%, transparent 82%, rgba(14,10,12,0.40) 100%);
  ```
- Prefer photos with 9:16-friendly composition: sign/wall/logo above, car below (showroom + dealer shots often hit this). Hero shot is usually `images[0]`.

### Generations + markets that have enough Elferspot inventory
- **Lineage (8):** 356, 930, 964, 993, 996, 997, 991, 992
- **Markets (6 buckets):** DE (Stuttgart), NL (Amsterdam), BE (Antwerp), IT (Milan), UK (London), US (Monterey)

---

## Typography

- **No `<br>` in body copy.** Forced breaks don't account for rendered font width, so natural wrap + `<br>` produces double breaks that overlap. Use flex-column containers with `<span>` children per line.
  Exception: short display titles where each word is deliberately on its own line.
- Hook copy: Karla weight 800 uppercase, **96px**, letter-spacing `-0.01em`, line-height `0.98`.
- Series code (lineage): Cormorant italic, 220px.
- City names (markets): Cormorant italic, 148px.
- Finale wordmark: Cormorant weight 500, 172px.

---

## Hook pattern that worked (V4)

- Background: hero Porsche photo, `scale 1.08 → 1.00` over scene duration.
- Brand mark top-left (MonzaHaus wordmark, Cormorant ~54px).
- Eyebrow: "914 Porsches · live inventory" (Karla 700 uppercase, 0.36em tracking, rose).
- Line A slams up at 0.25s (`y:40→0, opacity:0→1, 0.4s, expo.out`), fades at 0.9s.
- Line B clip-path wipes from left at 0.9s (`inset(0 100% 0 0) → inset(0 0% 0 0), 0.55s, expo.out`).
- Copy: "FOLLOW TO SEE / THE ONE PORSCHE" → "WE'D ACTUALLY / BUY RIGHT NOW."

---

## GSAP / HyperFrames gotchas

- **`tl.from` ends at the element's current CSS.** If CSS has `opacity: 0`, the `from(opacity: 0)` animation ends at 0 — the element never appears. Use `tl.fromTo` to set both start and end explicitly, or remove the CSS `opacity: 0` and rely on the tween to set it.
- Timelines must be built **synchronously** — no `async`/`await`, `setTimeout`, or Promises inside the timeline construction block.
- Never `repeat: -1`. Calculate finite repeat counts from scene duration.
- Video must be `muted playsinline`; audio is always a separate `<audio>` element.
- Audio tracks: one clip per track index, or use separate indices for overlapping clips.

---

## Workflow

```bash
# Fetch fresh photos (Elferspot-only, 8 lineage + 6 markets + 5 details)
npx tsx scripts/fetch-monzahaus-photos.ts

# Validate before render
cd videos/monzahaus-30s
npx hyperframes lint        # must be 0 errors, 0 warnings
npx hyperframes validate    # contrast warnings about exited scenes are spurious — ignore

# Render (takes ~10–14 min for 21s with 6 parallel workers)
npx hyperframes render --output renders/monzahaus-21s-vN.mp4

# Verify
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 renders/monzahaus-21s-vN.mp4
```

## File map

- Compositions: `videos/monzahaus-30s/compositions/{cold-open,lineage,continents,conviction,finale}.html`
- Photos: `videos/monzahaus-30s/assets/photos/` (manifest at `assets/photo-manifest.json`)
- Fetch script: `scripts/fetch-monzahaus-photos.ts`
- Renders: `videos/monzahaus-30s/renders/` (keep prior versions for comparison)
