"use client"

import Image from "next/image"
import { DollarSign, Car, Shield, ChevronRight } from "lucide-react"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion } from "@/lib/regionPricing"

// ─── GENERATION AGGREGATE TYPE ───
export type GenerationAggregate = {
  id: string
  label: string
  carCount: number
  priceMin: number
  priceMax: number
  yearMin: number
  yearMax: number
  representativeImage: string
  representativeCar: string
  topGrade: string
}

// ─── GENERATION FEED CARD (Full-height card for generation drill-down) ───
export function GenerationFeedCard({ gen, familyName, make, onClick }: { gen: GenerationAggregate; familyName: string; make: string; onClick: () => void }) {
  const { selectedRegion } = useRegion()

  return (
    <div className="h-[calc(100dvh-80px)] w-full flex flex-col snap-start p-4">
      <button
        onClick={onClick}
        className="flex-1 flex flex-col rounded-[32px] overflow-hidden bg-card border border-border group cursor-pointer hover:border-primary/20 transition-all duration-300 text-left"
      >
        {/* TOP: CINEMATIC IMAGE */}
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden">
          {gen.representativeImage ? (
            <Image
              src={gen.representativeImage}
              alt={`${make} ${familyName} ${gen.label}`}
              fill
              className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
              sizes="50vw"
              loading="lazy"
              referrerPolicy="no-referrer"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 bg-card flex items-center justify-center">
              <span className="text-muted-foreground text-lg">{familyName} {gen.label}</span>
            </div>
          )}

          {/* Vignette gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent dark:from-card pointer-events-none" />

          {/* Grade badge — top left */}
          <div className="absolute top-4 left-4">
            <span className={`rounded-full backdrop-blur-md px-3 py-1.5 text-[10px] font-bold tracking-[0.1em] uppercase ${
              gen.topGrade === "AAA"
                ? "bg-emerald-500/30 text-emerald-300"
                : gen.topGrade === "AA"
                  ? "bg-primary/30 text-primary"
                  : "bg-foreground/20 text-white"
            }`}>
              {gen.topGrade}
            </span>
          </div>

          {/* Car count badge — top right */}
          <div className="absolute top-4 right-4">
            <span className="rounded-full bg-background/70 backdrop-blur-md px-3 py-1.5 text-[10px] font-medium tracking-[0.1em] uppercase text-foreground">
              {gen.carCount} {gen.carCount === 1 ? "car" : "cars"}
            </span>
          </div>
        </div>

        {/* BOTTOM: GENERATION INFO */}
        <div className="flex-1 w-full bg-card p-6 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-primary mb-1">
              {make} {familyName}
            </p>
            <h2 className="text-3xl font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
              {gen.label}
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1">
              {gen.representativeCar}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">Price Range</span>
              </div>
              <p className="text-[13px] font-mono text-foreground">
                {formatPriceForRegion(gen.priceMin, selectedRegion)}&ndash;{formatPriceForRegion(gen.priceMax, selectedRegion)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Car className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">Listings</span>
              </div>
              <p className="text-[13px] text-foreground">{gen.carCount} vehicles</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Shield className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">Grade</span>
              </div>
              <p className={`text-[13px] font-semibold ${
                gen.topGrade === "AAA" ? "text-emerald-400"
                  : gen.topGrade === "AA" ? "text-blue-400"
                    : gen.topGrade === "A" ? "text-amber-400"
                      : "text-muted-foreground"
              }`}>{gen.topGrade}</p>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-6 flex items-center justify-between">
            <span className="text-[12px] font-medium tracking-[0.1em] uppercase text-muted-foreground group-hover:text-primary transition-colors">
              View Listings
            </span>
            <ChevronRight className="size-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </button>
    </div>
  )
}
