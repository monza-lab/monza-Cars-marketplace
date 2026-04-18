"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { AuctionCard } from "@/components/auction/AuctionCard"

interface AuctionData {
  id: string
  title: string
  make: string
  model: string
  year: number
  currentBid: number | null
  bidCount: number | null
  endTime: string | null
  images: string[]
  platform: "BRING_A_TRAILER" | "CARS_AND_BIDS" | "COLLECTING_CARS"
  status: "ACTIVE" | "ENDING_SOON" | "SOLD" | "ENDED" | "NO_SALE"
  reserveStatus: "NO_RESERVE" | "RESERVE_MET" | "RESERVE_NOT_MET" | null
}

export function LiveAuctionsSection() {
  const [auctions, setAuctions] = useState<AuctionData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/auctions?limit=8&sortBy=createdAt&sortOrder=desc")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setAuctions(res.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="relative py-24 monza-section-glow">
      {/* Section header */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div
          className="mb-12 flex items-center justify-between"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl">
              Featured <span className="font-semibold text-primary">Listings</span>
            </h2>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-primary">
              Live
            </span>
          </div>

          <Link
            href="/auctions"
            className="group inline-flex items-center gap-1.5 text-[11px] font-medium tracking-[0.15em] uppercase text-muted-foreground transition-colors hover:text-primary"
          >
            View All
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      </div>

      {/* Scrollable row */}
      <div className="relative">
        {/* Fade edges */}
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-12 bg-gradient-to-r from-background to-transparent sm:w-20" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-12 bg-gradient-to-l from-background to-transparent sm:w-20" />

        <div className="scrollbar-hide flex gap-5 overflow-x-auto px-4 pb-4 sm:px-8 lg:px-16">
          <div className="w-0 shrink-0 sm:w-4 lg:w-8" />

          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[320px] shrink-0 sm:w-[340px] rounded-2xl border border-primary/6 bg-card animate-pulse"
                >
                  <div className="aspect-[16/10] bg-primary/3" />
                  <div className="space-y-3 p-5">
                    <div className="h-4 w-3/4 rounded bg-primary/6" />
                    <div className="h-6 w-1/2 rounded bg-primary/6" />
                    <div className="h-3 w-full rounded bg-primary/4" />
                  </div>
                </div>
              ))
            : auctions.map((auction) => (
                <div key={auction.id} className="w-[320px] shrink-0 sm:w-[340px]">
                  <AuctionCard
                    auction={{
                      ...auction,
                      currentBid: auction.currentBid ?? 0,
                      bidCount: auction.bidCount ?? 0,
                      endTime: auction.endTime ? new Date(auction.endTime).toISOString() : null,
                    }}
                  />
                </div>
              ))}

          <div className="w-0 shrink-0 sm:w-4 lg:w-8" />
        </div>
      </div>

      {/* Mobile CTA */}
      <div className="mt-8 text-center sm:hidden">
        <Link
          href="/auctions"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-primary-foreground"
        >
          View All Listings
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  )
}
