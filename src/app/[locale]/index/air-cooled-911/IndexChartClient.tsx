"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type {
  IndexBucket,
  AirCooledSeries,
} from "@/lib/index/airCooled911";
import { AIR_COOLED_SERIES, AIR_COOLED_SERIES_LABELS } from "@/lib/index/airCooled911";

const SERIES_COLORS: Record<AirCooledSeries, string> = {
  "993": "#d4a017",
  "964": "#c0392b",
  "g-body": "#2c7a7b",
  "930": "#6b46c1",
  "early-911": "#374151",
};

function formatUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

export function IndexChartClient({ buckets }: { buckets: IndexBucket[] }) {
  const [enabled, setEnabled] = useState<Record<AirCooledSeries, boolean>>(() =>
    AIR_COOLED_SERIES.reduce(
      (acc, s) => ({ ...acc, [s]: true }),
      {} as Record<AirCooledSeries, boolean>
    )
  );

  const rows = useMemo(() => {
    const byQuarter = new Map<string, Record<string, number | string>>();
    for (const b of buckets) {
      const existing = byQuarter.get(b.quarter) ?? { quarter: b.quarter };
      existing[b.series] = b.median;
      byQuarter.set(b.quarter, existing);
    }
    return Array.from(byQuarter.values()).sort((a, b) =>
      String(a.quarter).localeCompare(String(b.quarter))
    );
  }, [buckets]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {AIR_COOLED_SERIES.map((s) => (
          <button
            key={s}
            onClick={() => setEnabled((e) => ({ ...e, [s]: !e[s] }))}
            className={`px-3 py-1.5 text-xs rounded-full border transition ${
              enabled[s]
                ? "border-amber-500 text-amber-100 bg-amber-500/10"
                : "border-zinc-700 text-zinc-500 bg-transparent"
            }`}
            style={enabled[s] ? { borderColor: SERIES_COLORS[s] } : undefined}
          >
            {AIR_COOLED_SERIES_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="h-[420px] w-full rounded-lg border border-zinc-800 bg-black/30 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 12, right: 24, bottom: 12, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="quarter"
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              tickLine={{ stroke: "#3f3f46" }}
              axisLine={{ stroke: "#3f3f46" }}
            />
            <YAxis
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              tickLine={{ stroke: "#3f3f46" }}
              axisLine={{ stroke: "#3f3f46" }}
              tickFormatter={formatUsd}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: "0.375rem",
                color: "#fafafa",
                fontSize: "12px",
              }}
              formatter={((value: number, name: string) => [
                formatUsd(value),
                AIR_COOLED_SERIES_LABELS[name as AirCooledSeries] ?? name,
              ]) as unknown as undefined}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", color: "#a1a1aa" }}
              formatter={(value: string) => AIR_COOLED_SERIES_LABELS[value as AirCooledSeries] ?? value}
            />
            {AIR_COOLED_SERIES.map((s) =>
              enabled[s] ? (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stroke={SERIES_COLORS[s]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              ) : null
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
