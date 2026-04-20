import Link from "next/link";
import type { PorscheModelPage } from "@/lib/models/types";
import type { IndexSummary } from "@/lib/index/factory";
import { getModelAdjacency } from "@/lib/models/adjacency";
import { getPorscheModel } from "@/lib/models/registry";
import { getVariantsForModel } from "@/lib/variants/registry";

function formatUsd(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function formatPct(n: number | null) {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function ModelPageLayout({
  model,
  marketSummary,
  locale,
}: {
  model: PorscheModelPage;
  marketSummary: IndexSummary<string> | null;
  locale: string;
}) {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto max-w-4xl px-6 py-12 space-y-12">
        <header className="space-y-4">
          <nav className="text-xs text-zinc-500 flex gap-2 items-center">
            <Link href={`/${locale}`} className="hover:text-amber-400">Home</Link>
            <span>/</span>
            <Link href={`/${locale}/cars/porsche`} className="hover:text-amber-400">Porsche</Link>
            <span>/</span>
            <span className="text-zinc-300">{model.shortName}</span>
          </nav>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-500">Porsche · {model.specs.yearRange}</p>
          <h1 className="text-4xl md:text-5xl font-serif leading-tight">{model.fullName}</h1>
          <p className="text-lg text-zinc-400 max-w-3xl">{model.tagline}</p>
        </header>

        {marketSummary && marketSummary.latestMedian != null && (
          <section className="border border-zinc-800 rounded-lg p-6 bg-zinc-950">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">
                  Current market median (MonzaHaus Index)
                </p>
                <p className="text-4xl font-serif mt-2">{formatUsd(marketSummary.latestMedian)}</p>
                <p className="text-xs mt-1 space-x-2">
                  <span
                    className={
                      marketSummary.yoyChangePct == null
                        ? "text-zinc-600"
                        : marketSummary.yoyChangePct >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                    }
                  >
                    YoY {formatPct(marketSummary.yoyChangePct)}
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-500">
                    n = {marketSummary.sampleSize.toLocaleString()} sales
                  </span>
                </p>
              </div>
              <Link
                href={`/${locale}/indices/${model.indexSlug}`}
                className="text-sm text-amber-400 hover:underline whitespace-nowrap"
              >
                View full index →
              </Link>
            </div>
          </section>
        )}

        <section className="prose prose-invert max-w-none text-zinc-300">
          {model.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        <section>
          <h2 className="text-2xl font-serif mb-4">Specifications</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm border border-zinc-800 rounded-lg p-6 bg-zinc-950">
            {[
              ["Production years", model.specs.yearRange],
              ["Total production", model.specs.production],
              ["Engine", model.specs.engine],
              ["Power", model.specs.power],
              ["Transmission", model.specs.transmission],
              ["0–60 mph", model.specs.zeroToSixty],
              ["Top speed", model.specs.topSpeed],
              ["Curb weight", model.specs.curbWeight],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-zinc-900 pb-2">
                <dt className="text-zinc-500">{k}</dt>
                <dd className="text-zinc-200 text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className="text-2xl font-serif mb-4">Notable variants</h2>
          <div className="space-y-3">
            {model.variants.map((v) => (
              <div
                key={v.name}
                className="border border-zinc-800 rounded-lg p-4 bg-zinc-950"
              >
                <div className="flex justify-between items-baseline gap-4 flex-wrap">
                  <h3 className="font-serif text-lg text-zinc-100">{v.name}</h3>
                  <span className="text-xs text-zinc-500">{v.yearRange}</span>
                </div>
                <p className="text-sm text-zinc-400 mt-1">{v.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-serif mb-4">Frequently asked questions</h2>
          <div className="space-y-4">
            {model.faqs.map((faq) => (
              <details
                key={faq.question}
                className="border border-zinc-800 rounded-lg p-4 bg-zinc-950 group"
              >
                <summary className="cursor-pointer font-medium text-zinc-100 list-none flex justify-between items-center gap-4">
                  <span>{faq.question}</span>
                  <span className="text-amber-500 text-xl group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-3 text-sm text-zinc-400 leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-serif mb-4">Buyer considerations</h2>
          <ul className="space-y-2 text-sm text-zinc-400">
            {model.buyerConsiderations.map((c, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-amber-500 shrink-0">·</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>

        {(() => {
          const variants = getVariantsForModel(model.slug);
          if (variants.length === 0) return null;
          return (
            <section>
              <h2 className="text-2xl font-serif mb-4">Variant deep-dives</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {variants.map((v) => (
                  <Link
                    key={v.slug}
                    href={`/${locale}/variants/porsche/${v.slug}`}
                    className="group border border-zinc-800 rounded-lg p-4 bg-zinc-950 hover:border-amber-600/40 transition"
                  >
                    <p className="text-xs uppercase tracking-wider text-zinc-500">
                      {v.yearRange}
                    </p>
                    <h3 className="text-lg font-serif mt-1 group-hover:text-amber-400 transition">
                      {v.shortName}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-2">{v.tagline}</p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })()}

        <section className="border-l-2 border-amber-500 pl-6 py-2">
          <h2 className="text-xl font-serif mb-2 text-zinc-100">MonzaHaus thesis</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">{model.thesis}</p>
        </section>

        {(() => {
          const adj = getModelAdjacency(model.slug);
          const prevModel = adj.prev ? getPorscheModel(adj.prev) : null;
          const nextModel = adj.next ? getPorscheModel(adj.next) : null;
          if (!prevModel && !nextModel && !adj.comparisonPrev && !adj.comparisonNext) return null;
          return (
            <section>
              <h2 className="text-2xl font-serif mb-4">Related generations</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {prevModel && (
                  <Link
                    href={`/${locale}/models/porsche/${prevModel.slug}`}
                    className="group border border-zinc-800 rounded-lg p-4 bg-zinc-950 hover:border-amber-600/40 transition"
                  >
                    <p className="text-xs uppercase tracking-wider text-zinc-500">Previous generation</p>
                    <p className="text-lg font-serif mt-1 group-hover:text-amber-400 transition">
                      ← {prevModel.fullName}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">{prevModel.specs.yearRange}</p>
                  </Link>
                )}
                {nextModel && (
                  <Link
                    href={`/${locale}/models/porsche/${nextModel.slug}`}
                    className="group border border-zinc-800 rounded-lg p-4 bg-zinc-950 hover:border-amber-600/40 transition"
                  >
                    <p className="text-xs uppercase tracking-wider text-zinc-500">Next generation</p>
                    <p className="text-lg font-serif mt-1 group-hover:text-amber-400 transition">
                      {nextModel.fullName} →
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">{nextModel.specs.yearRange}</p>
                  </Link>
                )}
              </div>
              {(adj.comparisonPrev || adj.comparisonNext) && (
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  {adj.comparisonPrev && prevModel && (
                    <Link
                      href={`/${locale}/compare/${adj.comparisonPrev}`}
                      className="text-amber-400 hover:underline"
                    >
                      Compare: {prevModel.shortName} vs {model.shortName} →
                    </Link>
                  )}
                  {adj.comparisonNext && nextModel && (
                    <Link
                      href={`/${locale}/compare/${adj.comparisonNext}`}
                      className="text-amber-400 hover:underline"
                    >
                      Compare: {model.shortName} vs {nextModel.shortName} →
                    </Link>
                  )}
                </div>
              )}
            </section>
          );
        })()}

        <section className="text-xs text-zinc-500 pt-8 border-t border-zinc-900">
          Market data and commentary are provided for informational purposes and do
          not constitute investment advice. For live listings, see our{" "}
          <Link
            href={`/${locale}/cars/porsche?series=${model.slug}`}
            className="text-amber-400 hover:underline"
          >
            {model.shortName} marketplace
          </Link>
          .
        </section>
      </div>
    </div>
  );
}
