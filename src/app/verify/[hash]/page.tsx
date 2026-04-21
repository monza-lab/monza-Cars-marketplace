import Link from "next/link"
import { getReportByHash } from "@/lib/reports/queries"
import { CURATED_CARS } from "@/lib/curatedCars"
import { fetchLiveListingById } from "@/lib/supabaseLiveListings"
import type { CollectorCar } from "@/lib/curatedCars"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface VerifyPageProps {
  params: Promise<{ hash: string }>
}

export async function generateMetadata({ params }: VerifyPageProps) {
  const { hash } = await params
  return {
    title: `Verify Haus Report · ${hash.slice(0, 12)} | Monza Haus`,
    description:
      "Confirm the authenticity of a Monza Haus report by its unique SHA256 hash.",
    robots: { index: false, follow: false },
  }
}

async function resolveCar(listingId: string): Promise<CollectorCar | null> {
  const curated = CURATED_CARS.find((c) => c.id === listingId)
  if (curated) return curated
  if (listingId.startsWith("live-")) {
    try {
      return await fetchLiveListingById(listingId)
    } catch {
      return null
    }
  }
  return null
}

function fmtK(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—"
  return `$${Math.round(v / 1000)}K`
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

export default async function VerifyPage({ params }: VerifyPageProps) {
  const { hash } = await params
  const result = await getReportByHash(hash)

  // ─── Schema-pending fallback ──────────────────────────────────────
  // The BE migration that adds the `report_hash` column hasn't shipped yet.
  // Show a friendly informational page rather than 500-ing.
  if (result.status === "schema_pending") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12 text-center">
        <div className="max-w-xl space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[3px] text-primary">
            Monza Haus · Verify
          </p>
          <h1 className="font-serif text-[28px] font-semibold">
            Verification is coming soon
          </h1>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Report verification goes live once the backend finishes provisioning
            our public index. In the meantime, you can access this report by
            contacting Monza Haus and referencing hash:
          </p>
          <p className="break-all rounded-lg border border-dashed border-border bg-card/30 p-3 font-mono text-[12px]">
            {hash}
          </p>
          <Link
            href="/"
            className="inline-block rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground"
          >
            Return home
          </Link>
        </div>
      </main>
    )
  }

  // ─── Not found ────────────────────────────────────────────────────
  if (result.status === "not_found") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12 text-center">
        <div className="max-w-xl space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[3px] text-destructive">
            Not found
          </p>
          <h1 className="font-serif text-[28px] font-semibold">
            This hash does not match any published Haus Report
          </h1>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            The file you were shown may have been tampered with, or the report
            was regenerated with a different hash. If you received this link
            from someone you trust, ask them to re-send the current verify
            URL from their report page.
          </p>
          <p className="break-all rounded-lg border border-dashed border-border bg-card/30 p-3 font-mono text-[11px]">
            Requested hash: {hash}
          </p>
          <Link
            href="/"
            className="inline-block rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground"
          >
            Return home
          </Link>
        </div>
      </main>
    )
  }

  // ─── Found ────────────────────────────────────────────────────────
  const { report } = result
  const car = await resolveCar(report.listing_id)
  const carTitle = car
    ? `${car.year} ${car.make} ${car.model}${
        car.trim && car.trim !== "—" && car.trim !== car.model ? ` ${car.trim}` : ""
      }`
    : report.listing_id

  return (
    <main className="flex min-h-screen flex-col bg-background px-6 py-12">
      <div className="mx-auto w-full max-w-2xl">
        {/* Verified banner */}
        <div className="rounded-xl border-2 border-positive/40 bg-positive/5 p-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[3px] text-positive">
            ✓ Verified authentic
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            This hash matches a Haus Report on record with Monza Haus.
          </p>
        </div>

        <h1 className="mt-6 font-serif text-[28px] font-semibold">{carTitle}</h1>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Generated {fmtDate(report.created_at)} · Listing ID {report.listing_id}
        </p>

        <section className="mt-6 rounded-xl border border-border bg-card/30 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Specific-Car Fair Value
          </p>
          <p className="mt-2 font-mono text-[28px] font-bold">
            {fmtK(report.fair_value_low)} – {fmtK(report.fair_value_high)}
          </p>
          <p className="mt-2 text-[12px] text-muted-foreground">
            Mid {fmtK(report.median_price)} · {report.total_comparable_sales ?? "—"}{" "}
            comparables
          </p>
        </section>

        <section className="mt-4 rounded-xl border border-border bg-card/30 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Hash
          </p>
          <p className="mt-1 break-all font-mono text-[11px]">{hash}</p>
        </section>

        {car && (
          <Link
            href={`/en/cars/${car.make.toLowerCase()}/${car.id}/report`}
            className="mt-6 inline-block rounded-lg bg-primary px-5 py-3 text-center text-[13px] font-semibold text-primary-foreground"
          >
            View full report (requires sign-in)
          </Link>
        )}

        <footer className="mt-10 border-t border-border pt-4 text-[10px] leading-relaxed text-muted-foreground">
          Content is provided for informational and educational purposes only.
          Market signals, price benchmarks, and analytical assessments do not
          constitute financial, investment, legal, or tax advice. Monza Haus is
          an independent market intelligence platform, not affiliated with
          Porsche AG or any referenced marketplaces.
        </footer>
      </div>
    </main>
  )
}
