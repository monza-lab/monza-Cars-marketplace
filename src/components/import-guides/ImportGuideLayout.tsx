import { Link } from "@/i18n/navigation";
import type { ImportGuide } from "@/lib/import-guides/types";

export function ImportGuideLayout({
  guide,
}: {
  guide: ImportGuide;
}) {
  return (
    <div className="min-h-screen bg-black text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-12 space-y-12">
        <header className="space-y-4">
          <nav className="text-xs text-muted-foreground/80 flex gap-2 items-center flex-wrap">
            <Link href="/" className="hover:text-primary">Home</Link>
            <span>/</span>
            <Link href="/guides/import" className="hover:text-primary">
              Import Guides
            </Link>
            <span>/</span>
            <span className="text-foreground/80">{guide.country}</span>
          </nav>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">
            Import Guide · {guide.country}
          </p>
          <h1 className="text-4xl md:text-5xl font-serif leading-tight">
            How to import a Porsche to {guide.country}
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl">{guide.tagline}</p>
        </header>

        <section className="prose dark:prose-invert max-w-none text-foreground/80">
          {guide.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        <section>
          <h2 className="text-2xl font-serif mb-4">Regulatory context</h2>
          <div className="prose dark:prose-invert max-w-none text-muted-foreground">
            {guide.regulatoryContext.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-serif mb-4">Step-by-step procedure</h2>
          <ol className="space-y-4">
            {guide.steps.map((step, i) => (
              <li
                key={step.name}
                className="border border-border rounded-lg p-5 bg-card"
              >
                <div className="flex items-baseline gap-3">
                  <span className="text-primary font-serif text-xl shrink-0">
                    {i + 1}.
                  </span>
                  <div className="flex-1">
                    <h3 className="text-lg font-serif text-foreground">{step.name}</h3>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      {step.text}
                    </p>
                    {step.url && (
                      <a
                        href={step.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline mt-2 inline-block"
                      >
                        Official reference →
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-2xl font-serif mb-4">Typical cost breakdown</h2>
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <div className="grid grid-cols-[1fr_auto] text-xs uppercase tracking-wider text-muted-foreground/80 px-4 py-3 border-b border-border bg-card/50 gap-4">
              <div>Item</div>
              <div>Estimate</div>
            </div>
            {guide.costs.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_auto] px-4 py-3 border-b border-border last:border-b-0 gap-4 text-sm"
              >
                <div>
                  <div className="text-foreground/90">{row.label}</div>
                  {row.note && (
                    <div className="text-xs text-muted-foreground/80 mt-1">{row.note}</div>
                  )}
                </div>
                <div className="text-primary whitespace-nowrap">{row.estimate}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-serif mb-4">Common pitfalls to avoid</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {guide.pitfalls.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-red-400 shrink-0">·</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl bg-primary/[0.04] px-6 py-4">
          <h2 className="text-xl font-serif mb-2 text-foreground">Typical timeline</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{guide.timeline}</p>
        </section>

        <section>
          <h2 className="text-2xl font-serif mb-4">Frequently asked questions</h2>
          <div className="space-y-4">
            {guide.faqs.map((faq) => (
              <details
                key={faq.question}
                className="border border-border rounded-lg p-4 bg-card group"
              >
                <summary className="cursor-pointer font-medium text-foreground list-none flex justify-between items-center gap-4">
                  <span>{faq.question}</span>
                  <span className="text-primary text-xl group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="text-xs text-muted-foreground/80 pt-8 border-t border-border">
          Disclaimer: Import regulations change. This guide aggregates public
          information as of 2026-04 and does not constitute legal or tax advice.
          Always consult a licensed customs broker and a tax professional before
          executing an import.
        </section>
      </div>
    </div>
  );
}
