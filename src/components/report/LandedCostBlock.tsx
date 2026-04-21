import type { LandedCostBreakdown } from "@/lib/landedCost";
import { formatLandedCost } from "@/lib/landedCost/format";
import { TAX_RULES } from "@/lib/landedCost/taxes";

const COUNTRY_LABEL: Record<string, string> = {
  US: "United States",
  DE: "Germany",
  UK: "United Kingdom",
  JP: "Japan",
  IT: "Italy",
  BE: "Belgium",
  NL: "Netherlands",
};

interface Props {
  breakdown: LandedCostBreakdown;
  locale: string;
}

export function LandedCostBlock({ breakdown, locale }: Props) {
  const taxLabel = TAX_RULES[breakdown.destination].label;
  return (
    <section className="rounded-lg border border-border p-6 my-8">
      <header className="mb-1">
        <h2 className="text-lg font-semibold tracking-tight">
          Landed Cost (Estimate)
        </h2>
      </header>
      <p className="text-xs text-muted-foreground mb-4">
        Origin: {COUNTRY_LABEL[breakdown.origin] ?? breakdown.origin} · Destination:{" "}
        {COUNTRY_LABEL[breakdown.destination] ?? breakdown.destination}
      </p>

      <dl className="divide-y divide-border text-sm">
        <Row label="International shipping" range={breakdown.shipping} locale={locale} />
        <Row
          label="Marine insurance"
          range={breakdown.marineInsurance}
          locale={locale}
          hint="1.5–2.5% of CIF"
        />
        <Row label="Customs duty" range={breakdown.customsDuty} locale={locale} />
        <Row label={taxLabel} range={breakdown.vatOrSalesTax} locale={locale} />
        <Row label="Port & broker fees" range={breakdown.portAndBroker} locale={locale} />
        <Row label="Registration" range={breakdown.registration} locale={locale} />
      </dl>

      <dl className="mt-4 pt-4 border-t border-border text-sm space-y-2">
        <Row label="Import & delivery costs" range={breakdown.importCosts} locale={locale} bold />
        <Row label="Car price" range={breakdown.carPriceLocal} locale={locale} />
        <Row label="Total landed cost" range={breakdown.landedCost} locale={locale} bold />
      </dl>

      {breakdown.notes.length > 0 && (
        <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
          {breakdown.notes.map((n, i) => (
            <li key={i}>• {n}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({
  label,
  range,
  locale,
  hint,
  bold,
}: {
  label: string;
  range: { min: number; max: number; currency: "USD" | "EUR" | "GBP" | "JPY" };
  locale: string;
  hint?: string;
  bold?: boolean;
}) {
  const value =
    range.min === range.max
      ? new Intl.NumberFormat(locale, {
          style: "currency",
          currency: range.currency,
          maximumFractionDigits: 0,
        }).format(range.min)
      : formatLandedCost(range, locale);
  return (
    <div className={`flex justify-between py-1 ${bold ? "font-semibold" : ""}`}>
      <dt>
        {label}
        {hint && <span className="ml-2 text-xs text-muted-foreground">({hint})</span>}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}
