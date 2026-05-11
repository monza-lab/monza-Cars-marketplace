"use client";

import { motion } from "framer-motion";
import { Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { AuctionCard } from "./AuctionCard";
import type { Auction } from "@/types/auction";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AuctionGridProps {
  auctions: Auction[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
} as const;

// ---------------------------------------------------------------------------
// Skeleton card placeholder
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-lg shadow-black/20">
      {/* Image placeholder */}
      <Skeleton className="aspect-[16/10] w-full rounded-none bg-card" />

      {/* Body */}
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-4 w-3/4 bg-foreground/5" />
        <Skeleton className="h-6 w-1/3 bg-foreground/5" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16 bg-foreground/5" />
          <Skeleton className="h-3 w-24 bg-foreground/5" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center gap-4 py-20">
      <div className="flex size-16 items-center justify-center rounded-full border border-border bg-card/50">
        <Car className="size-7 text-muted-foreground/60" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">{message}</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Try adjusting your filters or check back later.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AuctionGrid({
  auctions,
  loading = false,
  emptyMessage = "No auctions found",
  className,
}: AuctionGridProps) {
  // Loading skeletons
  if (loading) {
    return (
      <div
        className={cn(
          "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3",
          className
        )}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  // Empty state
  if (!auctions || auctions.length === 0) {
    return (
      <div
        className={cn(
          "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3",
          className
        )}
      >
        <EmptyState message={emptyMessage} />
      </div>
    );
  }

  // Populated grid with staggered entrance
  return (
    <motion.div
      className={cn(
        "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {auctions.map((auction) => (
        <motion.div key={auction.id} variants={itemVariants}>
          <AuctionCard auction={auction} />
        </motion.div>
      ))}
    </motion.div>
  );
}
