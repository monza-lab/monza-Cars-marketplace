import { Info } from "lucide-react";

export function NoMarketplaceBanner() {
  return (
    <div className="border-b border-border bg-foreground/[0.02]">
      <div className="max-w-[1600px] mx-auto px-3 md:px-6 py-2.5 flex items-start md:items-center gap-2.5">
        <Info className="size-3.5 shrink-0 text-muted-foreground mt-0.5 md:mt-0" aria-hidden />
        <p className="text-[11px] md:text-[12px] text-muted-foreground leading-snug">
          <span className="font-medium text-foreground">MonzaHaus is intelligence, not a marketplace.</span>{" "}
          Every car here is listed on Bring a Trailer, Cars and Bids, Collecting Cars, Elferspot
          and other platforms — we publish the report; you go bid where the car actually lives.
        </p>
      </div>
    </div>
  );
}
