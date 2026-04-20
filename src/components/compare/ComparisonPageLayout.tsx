import { Link } from "@/i18n/navigation";
import type { ComparisonPage } from "@/lib/compare/types";
import type { PorscheModelPage } from "@/lib/models/types";
import type { IndexSummary } from "@/lib/index/factory";

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

export function ComparisonPageLayout({
  comparison,
  leftModel,
  rightModel,
  leftMarket,
  rightMarket,
}: {
  comparison: ComparisonPage;
  leftModel: PorscheModelPage;
  rightModel: PorscheModelPage;
  leftMarket: IndexSummary<string> | null;
  rightMarket: IndexSummary<string> | null;
}) {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-12 space-y-12">
        <header className="space-y-4">
          <nav className="text-xs text-zinc-500 flex gap-2 items-center">
            <Link href="/" className="hover:text-amber-400">Home</Link>
            <span>/</span>
            <Link href="/compare" className="hover:text-amber-400">Compare</Link>
            <span>/</span>
            <span className="text-zinc-300">{leftModel.shortName} vs {rightModel.shortName}</span>
          </nav>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-500">Comparison</p>
          <h1 className="text-4xl md:text-5xl font-serif leading-tight">
            Porsche {leftModel.shortName} vs {rightModel.shortName}
          </h1>
          <p className="text-lg text-zinc-400 max-w-3xl">{comparison.tagline}</p>
        </header>

        <section className="grid grid-cols-2 gap-4">
          {[
            { model: leftModel, market: leftMarket },
            { model: rightModel, market: rightMarket },
          ].map(({ model, market }) => (
            <Link
              key={model.slug}
              href={`/models/porsche/${model.slug}`}
              className="group border border-zinc-800 rounded-lg p-5 bg-zinc-950 hover:border-amber-600/40 transition"
            >
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                {model.specs.yearRange}
              </p>
              <h2 className="text-2xl font-serif mt-2 group-hover:text-amber-400 transition">
                {model.fullName}
              </h2>
              {market && market.latestMedian != null && (
                <div className="mt-3 text-sm">
                  <span className="text-zinc-200 font-medium">
                    {formatUsd(market.latestMedian)}
                  </span>
                  <span className="text-zinc-600 mx-2">·</span>
                  <span
                    className={
                      market.yoyChangePct == null
                        ? "text-zinc-500"
                        : market.yoyChangePct >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                    }
                  >
                    YoY {formatPct(market.yoyChangePct)}
                  </span>
                </div>
              )}
              <p className="mt-3 text-sm text-zinc-400">{model.tagline}</p>
            </Link>
          ))}
        </section>

        <section className="prose prose-invert max-w-none text-zinc-300">
          {comparison.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        <section>
          <h2 className="text-2xl font-serif mb-4">Side-by-side specs</h2>
          <div className="border border-zinc-800 rounded-lg bg-zinc-950 overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_1fr] text-xs uppercase tracking-wider text-zinc-500 px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
              <div>Metric</div>
              <div>{leftModel.shortName}</div>
              <div>{rightModel.shortName}</div>
            </div>
            {comparison.rows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_1fr_1fr] text-sm px-4 py-3 border-b border-zinc-900 last:border-b-0 gap-4"
              >
                <div className="text-zinc-500">{row.label}</div>
                <div
                  className={
                    row.favors === "left" ? "text-emerald-400" : "text-zinc-200"
                  }
                >
                  {row.leftValue}
                </div>
                <div
                  className={
                    row.favors === "right" ? "text-emerald-400" : "text-zinc-200"
                  }
                >
                  {row.rightValue}
                </div>
                {row.note && (
                  <div className="col-span-3 text-xs text-zinc-500 mt-1">{row.note}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {comparison.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-2xl font-serif mb-4">{section.heading}</h2>
            <div className="prose prose-invert max-w-none text-zinc-300">
              {section.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        ))}

        <section>
          <h2 className="text-2xl font-serif mb-4">Frequently asked questions</h2>
          <div className="space-y-4">
            {comparison.faqs.map((faq) => (
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

        <section className="border-l-2 border-amber-500 pl-6 py-2">
          <h2 className="text-xl font-serif mb-2 text-zinc-100">Verdict</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">{comparison.verdict}</p>
        </section>
      </div>
    </div>
  );
}
