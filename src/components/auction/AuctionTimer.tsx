"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Clock, AlertTriangle } from "lucide-react";

interface AuctionTimerProps {
  endTime: string;
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calculateTimeLeft(endTime: string): TimeLeft {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    total: diff,
  };
}

function padZero(n: number): string {
  return n.toString().padStart(2, "0");
}

export function AuctionTimer({ endTime, className }: AuctionTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    calculateTimeLeft(endTime)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const next = calculateTimeLeft(endTime);
      setTimeLeft(next);
      if (next.total <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  // Ended state
  if (timeLeft.total <= 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500",
          className
        )}
      >
        <Clock className="size-3.5" />
        Ended
      </span>
    );
  }

  const isUrgent = timeLeft.total < 15 * 60 * 1000; // < 15 minutes
  const isWarning =
    !isUrgent && timeLeft.total < 60 * 60 * 1000; // < 1 hour

  const segments: { label: string; value: string }[] = [];

  if (timeLeft.days > 0) {
    segments.push({ label: "d", value: String(timeLeft.days) });
  }
  segments.push({ label: "h", value: padZero(timeLeft.hours) });
  segments.push({ label: "m", value: padZero(timeLeft.minutes) });
  segments.push({ label: "s", value: padZero(timeLeft.seconds) });

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm tabular-nums tabular-nums",
        isUrgent
          ? "text-destructive animate-pulse"
          : isWarning
            ? "text-destructive"
            : "text-zinc-400",
        className
      )}
    >
      {isUrgent ? (
        <AlertTriangle className="size-3.5 shrink-0" />
      ) : (
        <Clock className="size-3.5 shrink-0" />
      )}
      {segments.map((seg, i) => (
        <span key={seg.label} className="flex items-baseline gap-px">
          {i > 0 && (
            <span className="mx-0.5 text-zinc-600">:</span>
          )}
          <span className="font-semibold">{seg.value}</span>
          <span className="text-[10px] text-zinc-500">{seg.label}</span>
        </span>
      ))}
    </span>
  );
}
