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
    <div className="min-h-screen bg-black text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-12 space-y-12">
        <header className="space-y-4">
          <nav className="text-xs text-muted-foreground/80 flex gap-2 items-center">
            <Link href="/" className="hover:text-primary">Home</Link>
            <span>/</span>
            <Link href="/compare" className="hover:text-primary">Compare</Link>
            <span>/</span>
            <span className="text-foreground/80">{leftModel.shortName} vs {rightModel.shortName}</span>
          </nav>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Comparison</p>
          <h1 className="text-4xl md:text-5xl font-serif leading-tight">
            Porsche {leftModel.shortName} vs {rightModel.shortName}
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl">{comparison.tagline}</p>
        </header>

        <section className="grid grid-cols-2 gap-4">
          {[
            { model: leftModel, market: leftMarket },
            { model: rightModel, market: rightMarket },
          ].map(({ model, market }) => (
            <Link
              key={model.slug}
              href={`/models/porsche/${model.slug}`}
              className="group border border-border rounded-lg p-5 bg-card hover:border-primary/40 transition"
            >
              <p className="text-xs uppercase tracking-wider text-muted-foreground/80">
                {model.specs.yearRange}
              </p>
              <h2 className="text-2xl font-serif mt-2 group-hover:text-primary transition">
                {model.fullName}
              </h2>
              {market && market.latestMedian != null && (
                <div className="mt-3 text-sm">
                  <span className="text-foreground/90 font-medium">
                    {formatUsd(market.latestMedian)}
                  </span>
                  <span className="text-muted-foreground/60 mx-2">·</span>
                  <span
                    className={
                      market.yoyChangePct == null
                        ? "text-muted-foreground/80"
                        : market.yoyChangePct >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                    }
                  >
                    YoY {formatPct(market.yoyChangePct)}
                  </span>
                </div>
              )}
              <p className="mt-3 text-sm text-muted-foreground">{model.tagline}</p>
            </Link>
          ))}
        </section>

        <section className="prose dark:prose-invert max-w-none text-foreground/80">
          {comparison.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        <section>
          <h2 className="text-2xl font-serif mb-4">Side-by-side specs</h2>
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_1fr] text-xs uppercase tracking-wider text-muted-foreground/80 px-4 py-3 border-b border-border bg-card/50">
              <div>Metric</div>
              <div>{leftModel.shortName}</div>
              <div>{rightModel.shortName}</div>
            </div>
            {comparison.rows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_1fr_1fr] text-sm px-4 py-3 border-b border-border last:border-b-0 gap-4"
              >
                <div className="text-muted-foreground/80">{row.label}</div>
                <div
                  className={
                    row.favors === "left" ? "text-emerald-400" : "text-foreground/90"
                  }
                >
                  {row.leftValue}
                </div>
                <div
                  className={
                    row.favors === "right" ? "text-emerald-400" : "text-foreground/90"
                  }
                >
                  {row.rightValue}
                </div>
                {row.note && (
                  <div className="col-span-3 text-xs text-muted-foreground/80 mt-1">{row.note}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {comparison.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-2xl font-serif mb-4">{section.heading}</h2>
            <div className="prose dark:prose-invert max-w-none text-foreground/80">
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
                className="border border-border rounded-lg p-4 bg-card group"
              >
                <summary className="cursor-pointer font-medium text-foreground list-none flex justify-between items-center gap-4">
                  <span>{faq.question}</span>
                  <span className="text-primary text-xl group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="border-l-2 border-primary/40 pl-6 py-2">
          <h2 className="text-xl font-serif mb-2 text-foreground">Verdict</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{comparison.verdict}</p>
        </section>
      </div>
    </div>
  );
}
