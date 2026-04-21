import type { ConsolidatedSources } from "@/lib/landedCost";

interface Props {
  sources: ConsolidatedSources;
}

function SourceLine({ name, url }: { name: string; url?: string }) {
  return (
    <li>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="underline"
        >
          {name}
        </a>
      ) : (
        <span>{name}</span>
      )}
    </li>
  );
}

export function SourcesBlock({ sources }: Props) {
  return (
    <section className="border-t border-border mt-8 pt-6 text-xs text-muted-foreground">
      <h3 className="text-sm font-medium text-foreground mb-3">
        Sources &amp; Methodology
      </h3>

      <div className="space-y-4">
        <div>
          <div className="font-medium text-foreground">Customs duty</div>
          <ul className="pl-4 list-disc space-y-0.5">
            <SourceLine name={sources.duty.name} url={sources.duty.url} />
          </ul>
        </div>

        <div>
          <div className="font-medium text-foreground">VAT / Sales tax</div>
          <ul className="pl-4 list-disc space-y-0.5">
            <SourceLine name={sources.tax.name} url={sources.tax.url} />
          </ul>
        </div>

        <div>
          <div className="font-medium text-foreground">
            International shipping &amp; insurance
          </div>
          <ul className="pl-4 list-disc space-y-0.5">
            {sources.shipping.map((s, i) => (
              <SourceLine key={i} name={s.name} url={s.url} />
            ))}
            <SourceLine
              name={sources.marineInsurance.name}
              url={sources.marineInsurance.url}
            />
          </ul>
        </div>

        <div>
          <div className="font-medium text-foreground">
            Port, broker &amp; registration fees
          </div>
          <ul className="pl-4 list-disc space-y-0.5">
            <SourceLine
              name={sources.portAndBroker.name}
              url={sources.portAndBroker.url}
            />
            <SourceLine
              name={sources.registration.name}
              url={sources.registration.url}
            />
          </ul>
        </div>

        <p className="pt-2">
          Last reviewed: {sources.lastReviewedOverall}. All landed-cost figures
          are estimates for planning purposes only. Final import costs vary
          based on port of origin, carrier, broker, state/province, and
          car-specific compliance requirements.
        </p>
      </div>
    </section>
  );
}
