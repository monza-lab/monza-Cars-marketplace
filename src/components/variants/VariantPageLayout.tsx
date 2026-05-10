import { Link } from "@/i18n/navigation";
import type { PorscheVariantPage } from "@/lib/variants/types";
import type { PorscheModelPage } from "@/lib/models/types";

export function VariantPageLayout({
  variant,
  parentModel,
}: {
  variant: PorscheVariantPage;
  parentModel: PorscheModelPage;
}) {
  return (
    <div className="min-h-screen bg-black text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-12 space-y-12">
        <header className="space-y-4">
          <nav className="text-xs text-muted-foreground/80 flex gap-2 items-center flex-wrap">
            <Link href="/" className="hover:text-primary">Home</Link>
            <span>/</span>
            <Link href="/cars/porsche" className="hover:text-primary">Porsche</Link>
            <span>/</span>
            <Link href={`/models/porsche/${parentModel.slug}`} className="hover:text-primary">
              {parentModel.shortName}
            </Link>
            <span>/</span>
            <span className="text-foreground/80">{variant.shortName}</span>
          </nav>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">
            Variant · {variant.yearRange}
          </p>
          <h1 className="text-4xl md:text-5xl font-serif leading-tight">{variant.fullName}</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">{variant.tagline}</p>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground/80 pt-2">
            <span>Produced: {variant.yearRange}</span>
            <span aria-hidden>·</span>
            <span>Production: {variant.production}</span>
          </div>
        </header>

        <section className="prose dark:prose-invert max-w-none text-foreground/80">
          {variant.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        <section>
          <h2 className="text-2xl font-serif mb-4">Why this variant matters</h2>
          <div className="prose dark:prose-invert max-w-none text-muted-foreground">
            {variant.significance.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-serif mb-4">Specifications</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm border border-border rounded-lg p-6 bg-card">
            {variant.specs.map((s) => (
              <div
                key={s.label}
                className="flex justify-between gap-4 border-b border-border pb-2"
              >
                <dt className="text-muted-foreground/80">{s.label}</dt>
                <dd className="text-foreground/90 text-right">{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className="text-2xl font-serif mb-4">How to identify this variant</h2>
          <dl className="grid grid-cols-1 gap-3 text-sm border border-border rounded-lg p-6 bg-card">
            {variant.identifiers.map((id) => (
              <div
                key={id.label}
                className="flex justify-between gap-4 flex-wrap border-b border-border pb-2 last:border-b-0"
              >
                <dt className="text-muted-foreground/80 font-medium shrink-0">{id.label}</dt>
                <dd className="text-foreground/80 text-right max-w-xl">{id.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {variant.subVariants && variant.subVariants.length > 0 && (
          <section>
            <h2 className="text-2xl font-serif mb-4">Sub-variants &amp; option packages</h2>
            <div className="space-y-3">
              {variant.subVariants.map((sv) => (
                <div
                  key={sv.name}
                  className="border border-border rounded-lg p-4 bg-card"
                >
                  <div className="flex justify-between items-baseline gap-4 flex-wrap">
                    <h3 className="font-serif text-lg text-foreground">{sv.name}</h3>
                    <span className="text-xs text-muted-foreground/80">
                      {sv.yearRange}
                      {sv.production ? ` · ${sv.production}` : ""}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{sv.note}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-2xl font-serif mb-4">Current market bands</h2>
          <div className="space-y-2">
            {variant.priceBands.map((band) => (
              <div
                key={band.label}
                className="border border-border rounded-lg p-4 bg-card"
              >
                <div className="flex justify-between items-baseline gap-4 flex-wrap">
                  <h3 className="text-sm font-medium text-foreground/80">{band.label}</h3>
                  <span className="text-lg font-serif text-primary">{band.range}</span>
                </div>
                {band.note && (
                  <p className="text-xs text-muted-foreground/80 mt-1">{band.note}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-serif mb-4">Buyer considerations</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {variant.buyerConsiderations.map((c, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-primary shrink-0">·</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-serif mb-4">Frequently asked questions</h2>
          <div className="space-y-4">
            {variant.faqs.map((faq) => (
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
          <h2 className="text-xl font-serif mb-2 text-foreground">MonzaHaus thesis</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{variant.thesis}</p>
        </section>

        <section className="text-xs text-muted-foreground/80 pt-8 border-t border-border space-y-2">
          <p>
            Back to{" "}
            <Link
              href={`/models/porsche/${parentModel.slug}`}
              className="text-primary hover:underline"
            >
              {parentModel.fullName} buyer&apos;s guide
            </Link>
            .
          </p>
          <p>
            Market bands are aggregated from public auction results. For the current
            generation-level median and YoY trend, see the{" "}
            <Link
              href={`/indices/${parentModel.indexSlug}`}
              className="text-primary hover:underline"
            >
              {parentModel.indexSlug === "air-cooled-911" ? "Air-Cooled" : "Water-Cooled"} 911 Index
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
