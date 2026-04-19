import Link from "next/link";
import type { KnowledgeArticle } from "@/lib/knowledge/types";

export function KnowledgeArticleLayout({
  article,
  locale,
}: {
  article: KnowledgeArticle;
  locale: string;
}) {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto max-w-4xl px-6 py-12 space-y-12">
        <header className="space-y-4">
          <nav className="text-xs text-zinc-500 flex gap-2 items-center flex-wrap">
            <Link href={`/${locale}`} className="hover:text-amber-400">Home</Link>
            <span>/</span>
            <Link href={`/${locale}/knowledge`} className="hover:text-amber-400">
              Knowledge
            </Link>
            <span>/</span>
            <span className="text-zinc-300 capitalize">{article.category}</span>
          </nav>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-500">
            Knowledge · {article.category}
          </p>
          <h1 className="text-4xl md:text-5xl font-serif leading-tight">
            {article.title}
          </h1>
          <p className="text-lg text-zinc-400 max-w-3xl">{article.summary}</p>
        </header>

        <section className="prose prose-invert max-w-none text-zinc-300">
          {article.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        {article.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-2xl font-serif mb-4">{s.heading}</h2>
            <div className="prose prose-invert max-w-none text-zinc-300">
              {s.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        ))}

        {article.howTo && (
          <section>
            <h2 className="text-2xl font-serif mb-4">{article.howTo.name}</h2>
            <p className="text-sm text-zinc-400 mb-4">{article.howTo.description}</p>
            <ol className="space-y-4">
              {article.howTo.steps.map((step, i) => (
                <li
                  key={step.name}
                  className="border border-zinc-800 rounded-lg p-5 bg-zinc-950"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="text-amber-500 font-serif text-xl shrink-0">
                      {i + 1}.
                    </span>
                    <div className="flex-1">
                      <h3 className="text-lg font-serif text-zinc-100">{step.name}</h3>
                      <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                        {step.text}
                      </p>
                      {step.url && (
                        <a
                          href={step.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-amber-400 hover:underline mt-2 inline-block"
                        >
                          External reference →
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section>
          <h2 className="text-2xl font-serif mb-4">Frequently asked questions</h2>
          <div className="space-y-4">
            {article.faqs.map((faq) => (
              <details
                key={faq.question}
                className="border border-zinc-800 rounded-lg p-4 bg-zinc-950 group"
              >
                <summary className="cursor-pointer font-medium text-zinc-100 list-none flex justify-between items-center gap-4">
                  <span>{faq.question}</span>
                  <span className="text-amber-500 text-xl group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="border-l-2 border-amber-500 pl-6 py-2">
          <h2 className="text-xl font-serif mb-2 text-zinc-100">Bottom line</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">{article.verdict}</p>
        </section>

        <section className="text-xs text-zinc-500 pt-8 border-t border-zinc-900">
          Published by MonzaHaus — independent Porsche collector intelligence
          platform. Content is informational and does not constitute legal, financial
          or mechanical-engineering advice. For any specific vehicle, consult a
          Porsche-specialist shop.
        </section>
      </div>
    </div>
  );
}
