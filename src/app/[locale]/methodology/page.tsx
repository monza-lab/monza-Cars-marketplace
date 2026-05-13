import React from "react"
import { getLocale, setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { ArrowLeft } from "lucide-react"

/**
 * Methodology page — public-facing explanation of how MonzaHaus computes
 * Fair Value, what each modifier means, the caps that prevent runaway
 * estimates, and where every claim is sourced.
 *
 * Linked from Haus Reports (PDF + Excel "Open methodology online"),
 * the Evidence sheet, and the report disclaimers.
 */

export async function generateMetadata() {
  const locale = await getLocale()
  const titles: Record<string, string> = {
    en: "Methodology | MonzaHaus",
    es: "Metodología | MonzaHaus",
    de: "Methodik | MonzaHaus",
    ja: "メソドロジー | MonzaHaus",
  }
  return {
    title: titles[locale] || titles.en,
    description:
      "How MonzaHaus calculates Fair Value for collector Porsche listings. The engine, the modifiers, the caps, the sources.",
  }
}

const LAST_UPDATED = "May 12, 2026"

function MethodologyContent() {
  return (
    <>
      <p className="text-[12px] text-muted-foreground/80 italic">
        Last updated: {LAST_UPDATED}
      </p>

      <p>
        The Haus Report is built on a transparent, sourced valuation engine.
        Every number you see in a report can be traced back to a comparable
        sale, a public citation, or an explicit assumption you can edit in
        the Excel export. This page documents the engine end-to-end.
      </p>

      <h2>1. The Fair Value engine</h2>
      <p>
        Fair Value is the median sold price of comparable vehicles of the
        same variant, adjusted by up to twelve premium/discount modifiers.
        Each modifier is tied to a signal we extract from the listing and
        cited to an independent source.
      </p>
      <p className="font-mono text-[12px] bg-muted/30 border border-border rounded-md p-4 my-4">
        Fair Value mid = Comparables Median × (1 + Market Δ) × (1 + Aggregate Modifier)
      </p>
      <p>
        The low and high bounds are derived from the 25th and 75th
        percentiles of the comparable distribution, then adjusted by the
        same modifiers. The mid is the central estimate; the range
        communicates the inherent variance in a thinly-traded asset class.
      </p>

      <h2>2. Comparable selection (layers)</h2>
      <p>
        Comparables are drawn from the MonzaHaus market data corpus —
        aggregated from public auction platforms and classified marketplaces
        — using three concentric layers:
      </p>
      <ul>
        <li>
          <strong>Strict layer</strong> — same variant (e.g. 992 GT3),
          same body style, same drivetrain. Highest signal, smallest sample.
        </li>
        <li>
          <strong>Series layer</strong> — same generation (e.g. 992), any
          variant. Used when the strict layer has fewer than 5 comparables.
        </li>
        <li>
          <strong>Family layer</strong> — same model line (e.g. 911), any
          generation. Last-resort fallback for very rare cars; flagged in
          the report.
        </li>
      </ul>
      <p>
        The layer used is disclosed on every report so the reader knows
        how concentrated the basis is.
      </p>

      <h2>3. The twelve modifiers</h2>
      <p>
        Each modifier captures a structural premium or discount the market
        consistently prices in. Individual modifiers are capped at ±15%;
        the aggregate is capped at ±35%. The caps prevent runaway estimates
        on cars with multiple positive (or negative) signals.
      </p>
      <ul>
        <li>
          <strong>Paint-to-Sample premium</strong> — rare special-order
          color, typically +10–15% per Hagerty market data.
        </li>
        <li>
          <strong>Complete service history</strong> — full documented
          service stamps; +3–6% per the PCA technical guidance.
        </li>
        <li>
          <strong>Low ownership count</strong> — single-owner cars trade
          at +3–8% over multi-owner equivalents.
        </li>
        <li>
          <strong>Original factory paint</strong> — no respray disclosed;
          +3–5% per Hagerty originality guidance.
        </li>
        <li>
          <strong>Documentation provided</strong> — window sticker, PPI,
          full books; +2–4% per Hagerty buyer-confidence data.
        </li>
        <li>
          <strong>Sold by Porsche specialist</strong> — Canepa, RPM, etc.;
          +2–4% reflecting curated provenance.
        </li>
        <li>
          <strong>Mileage delta</strong> — variance from the variant's
          median mileage; up to ±15%.
        </li>
        <li>
          <strong>Color rarity</strong> — non-standard hues; +1–5%.
        </li>
        <li>
          <strong>Transmission</strong> — manual on modern Porsches
          outperforms PDK; +5–10% on GT3 / Carrera S generations.
        </li>
        <li>
          <strong>Accident history</strong> — disclosed accidents discount
          by −5 to −12% depending on severity.
        </li>
        <li>
          <strong>Aftermarket modifications</strong> — non-OEM mods
          discount by −2 to −8% depending on reversibility.
        </li>
        <li>
          <strong>Title status</strong> — salvage or rebuilt titles
          discount by −25 to −40%.
        </li>
      </ul>

      <h2>4. Market intelligence dimensions (D1–D4)</h2>
      <p>
        Beyond Fair Value, four market dimensions provide context:
      </p>
      <ul>
        <li>
          <strong>D1 — Trajectory</strong> — 6-month and 12-month price
          trend for the variant, expressed as a percentage with direction.
        </li>
        <li>
          <strong>D2 — Cross-border arbitrage</strong> — price differentials
          across US, EU, UK and Japan markets, net of landed cost.
        </li>
        <li>
          <strong>D3 — Peer positioning</strong> — where this VIN sits
          within the variant's sold-price distribution (percentile).
        </li>
        <li>
          <strong>D4 — Confidence tier</strong> — composite of sample
          size, comparable freshness, and signal coverage. Reported as
          High / Medium / Low.
        </li>
      </ul>

      <h2>5. Data sources</h2>
      <p>
        Comparable sales and listings are aggregated from public auction
        platforms (Bring a Trailer, Cars &amp; Bids, Collecting Cars) and
        classified marketplaces (AutoScout24, Elferspot). Modifier weights
        and rationale cite independent third-party publications including
        Hagerty Insider, Porsche Club of America (PCA) technical
        publications, and marque-specific specialist commentary.
      </p>
      <p>
        We do not buy data from auction houses or accept compensation
        from marketplaces for featured placement. MonzaHaus is not
        affiliated with Porsche AG.
      </p>

      <h2>6. Refresh cadence</h2>
      <p>
        Comparable sales are ingested daily. The variant median, modifier
        weights, and confidence tiers are recomputed nightly. Live listing
        data on report pages refreshes every hour. Generated reports
        capture a point-in-time snapshot — the cover page records the
        generation timestamp.
      </p>

      <h2>7. What the report does NOT do</h2>
      <p>
        The Haus Report is informational. It does not constitute
        financial, legal, or tax advice. It does not predict your specific
        sale price — auction outcomes depend on bidder competition,
        condition disclosures, and timing factors the engine cannot model.
        It does not substitute for an in-person pre-purchase inspection
        by a qualified marque specialist.
      </p>
      <p>
        Past performance — whether of an individual vehicle, model line,
        or the broader collector market — does not indicate future
        results.
      </p>

      <h2>8. Engine versioning &amp; provenance</h2>
      <p>
        Every report carries an engine version (e.g. <code>v3</code>),
        a tier (<code>tier_1</code>–<code>tier_3</code>), and a content
        hash. The hash lets buyers and sellers verify the report has not
        been altered post-generation. Engine refinements are announced
        in the release notes and never silently change historical reports.
      </p>

      <h2>9. Feedback &amp; corrections</h2>
      <p>
        If you spot a comparable sale we missed, a modifier weight that
        looks off, or a source citation that is broken, write to{" "}
        <a href="mailto:methodology@monzalab.com">methodology@monzalab.com</a>.
        We log every correction and credit contributors in the changelog.
      </p>

      <p className="text-[11px] text-muted-foreground/70 mt-8">
        © 2026 Monza Lab LLC. All rights reserved.
      </p>
    </>
  )
}

export default async function MethodologyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const backLabels: Record<string, string> = {
    en: "Back",
    es: "Volver",
    de: "Zurück",
    ja: "戻る",
  }
  const titles: Record<string, string> = {
    en: "Methodology",
    es: "Metodología",
    de: "Methodik",
    ja: "メソドロジー",
  }
  const eyebrowLabels: Record<string, string> = {
    en: "The engine",
    es: "El motor",
    de: "Das Modell",
    ja: "エンジン",
  }

  return (
    <div className="min-h-screen bg-background pt-[var(--app-header-h,3.5rem)] md:pt-24 pb-16 px-6">
      <article className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-muted-foreground transition-colors mb-8"
        >
          <ArrowLeft className="size-3" />
          {backLabels[locale] || backLabels.en}
        </Link>

        <p className="text-[10px] uppercase tracking-[0.25em] text-primary/80 mb-3">
          {eyebrowLabels[locale] || eyebrowLabels.en}
        </p>

        <h1 className="font-display text-[36px] md:text-[52px] font-light text-foreground leading-[1.05] tracking-tight mb-4">
          {titles[locale] || titles.en}
        </h1>

        <p className="font-display text-[16px] md:text-[18px] text-muted-foreground/90 leading-relaxed mb-10">
          How Fair Value is calculated, where every claim is sourced, and
          what the report does not do.
        </p>

        <div className="prose-legal mt-2 space-y-4 text-[13px] leading-relaxed text-foreground/85 [&_h2]:font-display [&_h2]:text-[20px] [&_h2]:md:text-[22px] [&_h2]:font-normal [&_h2]:text-foreground [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:tracking-tight [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_strong]:text-foreground [&_a]:text-primary [&_a]:underline [&_code]:font-mono [&_code]:text-[11px] [&_code]:bg-muted/40 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
          <MethodologyContent />
        </div>
      </article>
    </div>
  )
}
