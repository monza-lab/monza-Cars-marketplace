import Link from "next/link";
import { ArrowLeft, Car, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4">
      {/* Background accent */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(120,119,198,0.04),transparent_70%)]" />

      <div className="relative text-center">
        {/* 404 number */}
        <div className="relative mb-6">
          <span className="text-[120px] font-black leading-none tracking-tighter text-zinc-900 sm:text-[160px]">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <Car className="size-16 text-primary/30 sm:size-20" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Vehicle Not Found
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base text-zinc-500">
          The page you are looking for may have been moved, sold at auction, or
          never existed in our garage.
        </p>

        {/* Decorative separator */}
        <div className="mx-auto my-8 flex items-center gap-3">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-zinc-800" />
          <div className="size-1.5 rounded-full bg-primary/50" />
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-zinc-800" />
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="gap-2">
            <Link href="/">
              <ArrowLeft className="size-4" />
              Back to Home
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="gap-2 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-foreground"
          >
            <Link href="/search">
              <Search className="size-4" />
              Search Auctions
            </Link>
          </Button>
        </div>

        {/* Bottom tag */}
        <p className="mt-12 text-[10px] uppercase tracking-widest text-zinc-700">
          Monza Lab &middot; Investment-Grade Automotive Assets
        </p>
      </div>
    </div>
  );
}
