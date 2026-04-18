import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import type { IndexConfig, IndexPayload } from "@/lib/index/factory";
import { IndexChart } from "./IndexChart";

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

export function IndexPageLayout<ID extends string>({
  config,
  payload,
  csvUrl,
  title,
  subtitle,
  methodology,
}: {
  config: IndexConfig<ID>;
  payload: IndexPayload<ID>;
  csvUrl: string;
  title: string;
  subtitle: string;
  methodology: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-12 space-y-10">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-500">
            MonzaHaus Index · v1
          </p>
          <h1 className="text-4xl md:text-5xl font-serif leading-tight">{title}</h1>
          <p className="max-w-3xl text-zinc-400 text-lg">{subtitle}</p>
          <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
            <span>
              Last updated:{" "}
              <time dateTime={payload.generatedAt}>
                {new Date(payload.generatedAt).toUTCString()}
              </time>
            </span>
            <span aria-hidden>·</span>
            <span>Sample size: {payload.sampleSize.toLocaleString()} sales</span>
            <span aria-hidden>·</span>
            <a href={csvUrl} className="text-amber-400 hover:underline">
              Download CSV
            </a>
          </div>
        </header>

        <section>
          <h2 className="text-xl font-serif mb-4">Current market snapshot</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {payload.summaries.map((s) => (
              <div
                key={s.series}
                className="border border-zinc-800 rounded-lg p-4 bg-zinc-950"
              >
                <div className="text-xs text-zinc-500">{s.label}</div>
                <div className="text-2xl font-serif mt-2">
                  {formatUsd(s.latestMedian)}
                </div>
                <div className="mt-1 text-xs space-x-2">
                  <span
                    className={
                      s.yoyChangePct == null
                        ? "text-zinc-600"
                        : s.yoyChangePct >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                    }
                  >
                    YoY {formatPct(s.yoyChangePct)}
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-500">
                    n = {s.sampleSize.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-serif mb-4">Quarterly median — historical</h2>
          <Suspense
            fallback={
              <div className="h-[420px] rounded-lg border border-zinc-800 bg-zinc-950 animate-pulse" />
            }
          >
            <IndexChart buckets={payload.buckets} series={config.series} />
          </Suspense>
        </section>

        <section className="prose prose-invert max-w-3xl text-zinc-400">
          <h2 className="text-xl font-serif text-zinc-100">Methodology</h2>
          {methodology}
          <p>
            This index is published under{" "}
            <Link
              href="https://creativecommons.org/licenses/by/4.0/"
              className="text-amber-400 hover:underline"
            >
              CC BY 4.0
            </Link>
            . Attribution: &ldquo;{config.name}&rdquo; with link to this page.
          </p>
        </section>
      </div>
    </div>
  );
}
