"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { Gavel, Eye, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuctionTimer } from "./AuctionTimer";
import type {
  Auction,
  Platform,
  AuctionStatus,
  ReserveStatus,
} from "@/types/auction";

interface AuctionCardProps {
  auction: Pick<
    Auction,
    | "id"
    | "title"
    | "make"
    | "model"
    | "year"
    | "currentBid"
    | "bidCount"
    | "endTime"
    | "images"
    | "platform"
    | "status"
    | "reserveStatus"
  >;
  className?: string;
}

const PLATFORM_CONFIG: Record<Platform, { label: string; className: string }> = {
  BRING_A_TRAILER: {
    label: "BaT",
    className: "bg-[rgba(248,180,217,0.15)] text-[#F8B4D9] border-[rgba(248,180,217,0.2)]",
  },
  CARS_AND_BIDS: {
    label: "C&B",
    className: "bg-[rgba(192,132,252,0.15)] text-[#c084fc] border-[rgba(192,132,252,0.2)]",
  },
  COLLECTING_CARS: {
    label: "CC",
    className: "bg-[rgba(103,232,249,0.15)] text-[#67e8f9] border-[rgba(103,232,249,0.2)]",
  },
};

const STATUS_CONFIG: Record<AuctionStatus, { label: string; className: string }> = {
  ACTIVE: {
    label: "Active",
    className: "bg-[rgba(248,180,217,0.1)] text-[#F8B4D9] border-[rgba(248,180,217,0.2)]",
  },
  ENDING_SOON: {
    label: "Ending Soon",
    className: "bg-[rgba(248,180,217,0.15)] text-[#F8B4D9] border-[rgba(248,180,217,0.25)] animate-pulse",
  },
  SOLD: {
    label: "Sold",
    className: "bg-[rgba(255,252,247,0.05)] text-[rgba(255,252,247,0.4)] border-[rgba(255,252,247,0.1)]",
  },
  ENDED: {
    label: "Ended",
    className: "bg-[rgba(255,252,247,0.05)] text-[rgba(255,252,247,0.4)] border-[rgba(255,252,247,0.1)]",
  },
  NO_SALE: {
    label: "No Sale",
    className: "bg-[rgba(248,113,113,0.15)] text-[#f87171] border-[rgba(248,113,113,0.2)]",
  },
};

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "$--";
  return `$${amount.toLocaleString("en-US")}`;
}

export function AuctionCard({ auction, className }: AuctionCardProps) {
  const {
    id, title, make, model, year, currentBid, bidCount,
    endTime, images, platform, status, reserveStatus,
  } = auction;

  const platformCfg = PLATFORM_CONFIG[platform];
  const statusCfg = STATUS_CONFIG[status];
  const heroImage = images?.[0];
  const isEnded = status === "SOLD" || status === "ENDED" || status === "NO_SALE";

  return (
    <Link href={`/auctions/${id}`} className="group block">
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={cn(
          "overflow-hidden rounded-2xl border border-[rgba(248,180,217,0.08)] bg-[rgba(15,14,22,0.9)]",
          "transition-all duration-300",
          "hover:border-[rgba(248,180,217,0.2)] hover:shadow-2xl hover:shadow-[rgba(248,180,217,0.04)]",
          isEnded && "opacity-70 group-hover:opacity-100",
          className
        )}
      >
        {/* Image */}
        <div className="relative aspect-[16/10] overflow-hidden bg-[#0b0b10]">
          {heroImage ? (
            <motion.div
              className="size-full"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            >
              <Image
                src={heroImage}
                alt={title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          ) : (
            <div className="flex size-full items-center justify-center">
              <ImageOff className="size-10 text-[rgba(255,252,247,0.1)]" />
            </div>
          )}

          {/* Gradient overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0b10] via-transparent to-transparent" />

          {/* Platform badge */}
          <span
            className={cn(
              "absolute left-3 top-3 rounded-full text-[10px] font-semibold tracking-[0.1em] uppercase border px-2.5 py-0.5 backdrop-blur-sm",
              platformCfg.className
            )}
          >
            {platformCfg.label}
          </span>

          {/* Status badge */}
          <span
            className={cn(
              "absolute right-3 top-3 rounded-full text-[10px] font-medium tracking-[0.1em] border px-2.5 py-0.5 backdrop-blur-sm",
              statusCfg.className
            )}
          >
            {statusCfg.label}
          </span>

          {/* No Reserve */}
          {reserveStatus === "NO_RESERVE" && (
            <span className="absolute bottom-3 left-3 rounded-full border border-[rgba(248,180,217,0.2)] bg-[rgba(248,180,217,0.1)] text-[10px] font-semibold tracking-[0.1em] uppercase text-[#F8B4D9] backdrop-blur-sm px-2.5 py-0.5">
              No Reserve
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-col gap-3 p-5">
          {/* Title */}
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[#FFFCF7] group-hover:text-[#F8B4D9] transition-colors">
            {year} {make} {model}
          </h3>

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-[#F8B4D9]">
              {formatCurrency(currentBid)}
            </span>
            {!isEnded && (
              <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-[rgba(255,252,247,0.35)]">
                current bid
              </span>
            )}
            {status === "SOLD" && (
              <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-[rgba(255,252,247,0.35)]">
                sold
              </span>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center justify-between text-[11px] text-[rgba(255,252,247,0.35)]">
            <span className="flex items-center gap-1.5">
              <Gavel className="size-3" />
              {bidCount} bid{bidCount !== 1 ? "s" : ""}
            </span>

            {endTime && !isEnded ? (
              <AuctionTimer endTime={endTime} className="text-[11px] font-mono text-[rgba(255,252,247,0.5)]" />
            ) : endTime && isEnded ? (
              <span className="flex items-center gap-1">
                <Eye className="size-3" />
                Ended
              </span>
            ) : null}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
