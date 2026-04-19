import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type ListingRow = {
  id: string;
  year: number;
  model: string;
  trim: string | null;
  source: string;
  source_url: string;
  status: string;
  sale_date: string;
  country: string;
  region: string | null;
  city: string | null;
  hammer_price: string | number | null;
  original_currency: string | null;
  photos_count: number;
  photos_media?: Array<{ photo_url: string | null }>;
};

export default async function FerrariDataPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // Keep locale param to align with the rest of the app.
  await params;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return (
      <div className="min-h-screen bg-background pt-28 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-light tracking-tight text-foreground">
            Ferrari Ingestion (Supabase)
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Missing env vars. Set <code className="text-primary">NEXT_PUBLIC_SUPABASE_URL</code> and
            either <code className="text-primary">SUPABASE_SERVICE_ROLE_KEY</code> (preferred) or
            <code className="text-primary">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
          </p>
        </div>
      </div>
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("listings")
    .select(
      "id,year,model,trim,source,source_url,status,sale_date,country,region,city,hammer_price,original_currency,photos_count,photos_media(photo_url)",
    )
    .eq("make", "Ferrari")
    .eq("status", "active")
    .order("sale_date", { ascending: false })
    .limit(120);

  const rows = (data ?? []) as ListingRow[];

  return (
    <div className="min-h-screen bg-background pt-28 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-2xl font-light tracking-tight text-foreground">
              Ferrari Ingestion (Supabase)
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Rendering from <code className="text-primary">public.listings</code> (make = Ferrari)
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground/60">
              rows
            </p>
            <p className="text-xl font-light text-foreground tabular-nums">{rows.length}</p>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-primary/15 bg-card px-4 py-3">
            <p className="text-sm text-destructive">Query error: {error.message}</p>
          </div>
        ) : null}

        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-card">
              <tr>
                {[
                  "Car",
                  "Status",
                  "Sale Date",
                  "Price",
                  "Location",
                  "Source",
                ].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-4 py-3 text-left text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground/70"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {rows.map((r) => {
                const photoUrl = r.photos_media?.find((p) => p.photo_url)?.photo_url ?? null;
                const priceText =
                  r.hammer_price !== null && r.hammer_price !== undefined
                    ? `${r.original_currency ?? ""} ${String(r.hammer_price)}`.trim()
                    : "";
                const carName = `${r.year} Ferrari ${r.model}${r.trim ? ` ${r.trim}` : ""}`;
                const location = [r.city, r.region, r.country].filter(Boolean).join(", ");

                return (
                  <tr key={r.id} className="hover:bg-foreground/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-14 overflow-hidden rounded-lg bg-foreground/5 border border-border">
                          {photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photoUrl}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : null}
                        </div>
                        <div>
                          <a
                            href={r.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-light text-foreground hover:text-primary"
                          >
                            {carName}
                          </a>
                          <div className="mt-0.5 text-[11px] text-muted-foreground/70">
                            photos: {r.photos_count}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-foreground/70">{r.status}</td>
                    <td className="px-4 py-3 text-[12px] text-foreground/70 tabular-nums">{r.sale_date}</td>
                    <td className="px-4 py-3 text-[12px] text-foreground/70 tabular-nums">
                      {priceText || "-"}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-foreground/70">{location || "-"}</td>
                    <td className="px-4 py-3 text-[12px] text-foreground/70">{r.source}</td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-muted-foreground/70"
                  >
                    No Ferrari rows yet. Run the collector to ingest.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-2xl border border-primary/8 bg-card px-4 py-3">
          <p className="text-[12px] text-muted-foreground">
            Ingestion CLI: <code className="text-primary">npx tsx src/features/ferrari_collector/cli.ts --mode=daily</code>
          </p>
        </div>
      </div>
    </div>
  );
}
